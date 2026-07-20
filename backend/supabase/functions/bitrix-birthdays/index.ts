import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  isCycleEligible,
  nextBirthdayOccurrence,
  parseBirthday,
} from "../_shared/birthday-task-contract.ts";
import {
  fetchActiveBitrixUsers,
  field as getField,
} from "../_shared/birthday-task-service.ts";
import { canViewBirthdays } from "../_shared/birthday-authorization.ts";

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
    if (!canViewBirthdays(appUser)) {
      return new Response(JSON.stringify({ error: "Acesso restrito aos usuários internos." }), {
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
    const rawUsers = await fetchActiveBitrixUsers();
    const birthdayRows = rawUsers
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

        const next = nextBirthdayOccurrence(birthday, now);
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
          taskCycleYear: next.cycle.year,
          taskCycleMonth: next.cycle.month,
          taskEligible: isCycleEligible(next.cycle, now),
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a?.daysUntil ?? 0) - (b?.daysUntil ?? 0) || String(a?.name).localeCompare(String(b?.name), "pt-BR"));

    const bitrixIds = birthdayRows.map((birthday) => String(birthday?.bitrixUserId ?? ""));
    const { data: taskCycles, error: taskCyclesError } = bitrixIds.length
      ? await adminClient
        .from("birthday_task_cycles")
        .select("bitrix_user_id,cycle_year,cycle_month,status,bitrix_task_id,last_error,updated_at")
        .in("bitrix_user_id", bitrixIds)
      : { data: [], error: null };
    if (taskCyclesError) throw new Error("Não foi possível consultar o estado das tarefas de aniversário.");
    const taskByCycle = new Map(
      (taskCycles ?? []).map((task: any) => [
        `${task.bitrix_user_id}:${task.cycle_year}-${task.cycle_month}`,
        task,
      ]),
    );
    const birthdays = birthdayRows.map((birthday) => {
      const task = taskByCycle.get(`${birthday?.bitrixUserId}:${birthday?.taskCycleYear}-${birthday?.taskCycleMonth}`) as any;
      return {
        ...birthday,
        taskStatus: task?.status ?? "not_created",
        taskId: task?.bitrix_task_id ? String(task.bitrix_task_id) : null,
        taskError: task?.last_error ?? null,
        taskUpdatedAt: task?.updated_at ?? null,
      };
    });
    const [{ data: automationState, error: stateError }, { data: recentRuns, error: runsError }] = await Promise.all([
      adminClient.from("birthday_automation_state").select("*").eq("scheduler_key", "birthday-reminders").maybeSingle(),
      adminClient.from("birthday_automation_runs")
        .select("source,status,started_at,finished_at,target_periods,summary,error_message")
        .order("started_at", { ascending: false })
        .limit(5),
    ]);
    if (stateError || runsError) throw new Error("Não foi possível consultar a saúde da rotina de aniversários.");

    return new Response(
      JSON.stringify({
        birthdays,
        total: birthdays.length,
        syncedAt: now.toISOString(),
        automation: { state: automationState, recentRuns: recentRuns ?? [] },
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
