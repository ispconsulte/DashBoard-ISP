import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
  "Cache-Control": "private, max-age=300",
};

const BITRIX_BASE_URL =
  Deno.env.get("BITRIX_ADMIN_BASE_URL")?.trim() ||
  Deno.env.get("BITRIX_BASE_URL")?.trim() ||
  "";

type BirthdayParts = { year: number; month: number; day: number };

function parseBirthday(value: unknown): BirthdayParts | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    return isValidBirthDate(year, month, day) ? { year, month, day } : null;
  }

  const br = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (br) {
    const day = Number(br[1]);
    const month = Number(br[2]);
    const year = Number(br[3]);
    return isValidBirthDate(year, month, day) ? { year, month, day } : null;
  }

  return null;
}

function isValidBirthDate(year: number, month: number, day: number) {
  if (!Number.isInteger(year) || year < 1900 || year > new Date().getUTCFullYear()) return false;
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1) {
    return false;
  }
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function nextBirthday(month: number, day: number, now: Date) {
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  let year = now.getUTCFullYear();
  let occurrence = Date.UTC(year, month - 1, day);
  if (occurrence < todayUtc) {
    year += 1;
    occurrence = Date.UTC(year, month - 1, day);
  }

  return {
    daysUntil: Math.round((occurrence - todayUtc) / 86_400_000),
    nextDate: new Date(occurrence).toISOString().slice(0, 10),
  };
}

function getField(record: Record<string, unknown>, lower: string, upper: string) {
  return record[upper] ?? record[lower];
}

async function fetchBitrixUsers() {
  if (!BITRIX_BASE_URL) throw new Error("Integração Bitrix não configurada.");

  const endpoint = new URL("user.get.json", BITRIX_BASE_URL).toString();
  const users: Record<string, unknown>[] = [];
  let start = 0;

  for (let page = 0; page < 100; page += 1) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        FILTER: { ACTIVE: true },
        sort: "ID",
        order: "ASC",
        start,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`Bitrix respondeu com HTTP ${response.status}.`);
    }

    const payload = await response.json();
    if (payload?.error) {
      throw new Error(`Bitrix recusou user.get: ${String(payload.error)}`);
    }

    const pageUsers = Array.isArray(payload?.result)
      ? payload.result
      : Object.values(payload?.result ?? {});
    users.push(...pageUsers);

    const next = Number(payload?.next);
    if (!Number.isFinite(next) || next <= start) break;
    start = next;
  }

  return users;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Método não permitido." }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Não autorizado." }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida." }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
    const { data: appUser, error: userError } = await adminClient
      .from("users")
      .select("role,user_profile,active")
      .eq("auth_user_id", authData.user.id)
      .maybeSingle();

    if (userError) throw new Error("Não foi possível validar o perfil do usuário.");
    const role = String(appUser?.role ?? appUser?.user_profile ?? "").toLowerCase();
    const canManageUsers = ["admin", "gerente", "coordenador"].includes(role);
    if (!appUser || appUser.active === false || !canManageUsers) {
      return new Response(JSON.stringify({ error: "Acesso restrito à gestão de usuários." }), {
        status: 403,
        headers: jsonHeaders,
      });
    }

    const { data: activeAppUsers, error: activeUsersError } = await adminClient
      .from("users")
      .select("bitrix_user_id")
      .eq("active", true)
      .not("bitrix_user_id", "is", null);
    if (activeUsersError) throw new Error("Não foi possível carregar os usuários ativos do sistema.");
    const activeBitrixIds = new Set(
      (activeAppUsers ?? [])
        .map((user) => String(user.bitrix_user_id ?? "").trim())
        .filter(Boolean),
    );

    const now = new Date();
    const rawUsers = await fetchBitrixUsers();
    const birthdays = rawUsers
      .filter((user) => {
        const bitrixId = String(getField(user, "id", "ID") ?? "").trim();
        const userType = String(getField(user, "user_type", "USER_TYPE") ?? "").toLowerCase();
        return activeBitrixIds.has(bitrixId) && userType === "employee";
      })
      .map((user) => {
        const birthday = parseBirthday(getField(user, "personal_birthday", "PERSONAL_BIRTHDAY"));
        if (!birthday) return null;

        const firstName = String(getField(user, "name", "NAME") ?? "").trim();
        const lastName = String(getField(user, "last_name", "LAST_NAME") ?? "").trim();
        const name = `${firstName} ${lastName}`.trim();
        if (!name) return null;

        const next = nextBirthday(birthday.month, birthday.day, now);
        return {
          bitrixUserId: String(getField(user, "id", "ID") ?? ""),
          name,
          month: birthday.month,
          day: birthday.day,
          year: birthday.year,
          birthDate: `${birthday.year}-${String(birthday.month).padStart(2, "0")}-${String(birthday.day).padStart(2, "0")}`,
          displayDate: `${String(birthday.day).padStart(2, "0")}/${String(birthday.month).padStart(2, "0")}/${birthday.year}`,
          daysUntil: next.daysUntil,
          nextDate: next.nextDate,
          isToday: next.daysUntil === 0,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a?.daysUntil ?? 0) - (b?.daysUntil ?? 0) || String(a?.name).localeCompare(String(b?.name), "pt-BR"));

    return new Response(
      JSON.stringify({
        birthdays,
        total: birthdays.length,
        syncedAt: now.toISOString(),
      }),
      { headers: jsonHeaders },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao consultar aniversários.";
    console.error("[bitrix-birthdays]", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: jsonHeaders,
    });
  }
});
