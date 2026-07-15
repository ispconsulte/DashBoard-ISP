import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BITRIX_BASE_URL =
  Deno.env.get("BITRIX_ADMIN_BASE_URL")?.trim() ||
  Deno.env.get("BITRIX_BASE_URL")?.trim() ||
  "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const responseHeaders = { ...corsHeaders, "Content-Type": "application/json" };

type Birthday = { year: number; month: number; day: number };
type BitrixUser = Record<string, unknown>;

function field(record: BitrixUser, lower: string, upper: string) {
  return record[upper] ?? record[lower];
}

function normalizeList(value: unknown): BitrixUser[] {
  if (Array.isArray(value)) return value as BitrixUser[];
  if (value && typeof value === "object") return Object.values(value) as BitrixUser[];
  return [];
}

function parseBirthday(value: unknown): Birthday | null {
  const raw = String(value ?? "").trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const br = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  const year = Number(iso?.[1] ?? br?.[3]);
  const month = Number(iso?.[2] ?? br?.[2]);
  const day = Number(iso?.[3] ?? br?.[1]);
  if (!year || !month || !day || month > 12 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) {
    return null;
  }
  return { year, month, day };
}

function normalizeName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function fullName(user: BitrixUser) {
  return `${String(field(user, "name", "NAME") ?? "")} ${String(field(user, "last_name", "LAST_NAME") ?? "")}`
    .replace(/\s+/g, " ")
    .trim();
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function displayDate(year: number, month: number, day: number) {
  return `${pad(day)}/${pad(month)}/${year}`;
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function shiftDate(year: number, month: number, day: number, deltaDays: number) {
  const date = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

async function bitrixPost(path: string, body: unknown) {
  if (!BITRIX_BASE_URL) throw new Error("BITRIX_BASE_URL não configurada.");
  const response = await fetch(new URL(path, BITRIX_BASE_URL), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error) {
    const code = String(payload?.error ?? `HTTP_${response.status}`);
    throw new Error(`Bitrix recusou ${path}: ${code}`);
  }
  return payload;
}

async function fetchActiveBitrixUsers() {
  const users: BitrixUser[] = [];
  let start = 0;
  for (let page = 0; page < 100; page += 1) {
    const payload = await bitrixPost("user.get.json", {
      FILTER: { ACTIVE: true },
      sort: "ID",
      order: "ASC",
      start,
    });
    users.push(...normalizeList(payload?.result));
    const next = Number(payload?.next);
    if (!Number.isFinite(next) || next <= start) break;
    start = next;
  }
  return users;
}

async function findExistingTask(title: string, responsibleId: string) {
  const payload = await bitrixPost("tasks.task.list.json", {
    filter: { TITLE: title, RESPONSIBLE_ID: responsibleId },
    select: ["ID", "TITLE", "RESPONSIBLE_ID"],
  });
  return normalizeList(payload?.result?.tasks ?? payload?.result).find(
    (task) => String(field(task, "title", "TITLE") ?? "") === title,
  );
}

async function addTask(params: {
  title: string;
  description: string;
  deadline: string;
  responsibleId: string;
  accompliceId: string;
}) {
  const body = new URLSearchParams();
  body.set("fields[TITLE]", params.title);
  body.set("fields[DESCRIPTION]", params.description);
  body.set("fields[RESPONSIBLE_ID]", params.responsibleId);
  body.set("fields[ACCOMPLICES][0]", params.accompliceId);
  body.set("fields[DEADLINE]", params.deadline);
  body.set("fields[TAGS][0]", "aniversario");
  body.set("fields[TAGS][1]", "automacao-aniversario");

  const response = await fetch(new URL("tasks.task.add.json", BITRIX_BASE_URL), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json().catch(() => null);
  const taskId = payload?.result?.task?.id ?? payload?.result?.id;
  if (!response.ok || payload?.error || !taskId) throw new Error("O Bitrix não confirmou a criação da tarefa.");
  return String(taskId);
}

async function ensureChecklist(taskId: string, titles: string[]) {
  const currentPayload = await bitrixPost("task.checklistitem.getlist.json", { TASKID: Number(taskId) });
  const currentTitles = new Set(
    normalizeList(currentPayload?.result).map((item) => String(field(item, "title", "TITLE") ?? "")),
  );

  const created: string[] = [];
  for (let index = 0; index < titles.length; index += 1) {
    const title = titles[index];
    if (currentTitles.has(title)) continue;
    await bitrixPost("task.checklistitem.add.json", {
      TASKID: Number(taskId),
      FIELDS: {
        TITLE: title,
        SORT_INDEX: (index + 1) * 100,
        IS_COMPLETE: "N",
        IS_IMPORTANT: "Y",
      },
    });
    created.push(title);
  }
  return created;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido." }), { status: 405, headers: responseHeaders });
  }

  try {
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authorization = req.headers.get("Authorization") ?? "";
    if (!serviceRoleKey || authorization !== `Bearer ${serviceRoleKey}`) {
      return new Response(JSON.stringify({ error: "Não autorizado." }), { status: 401, headers: responseHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dry_run === true;
    const now = new Date();
    const defaultTarget = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const targetMonth = Number(body?.target_month ?? defaultTarget.getUTCMonth() + 1);
    const targetYear = Number(body?.target_year ?? defaultTarget.getUTCFullYear());
    if (!Number.isInteger(targetMonth) || targetMonth < 1 || targetMonth > 12 || !Number.isInteger(targetYear)) {
      return new Response(JSON.stringify({ error: "Período alvo inválido." }), { status: 400, headers: responseHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceRoleKey,
      { auth: { persistSession: false } },
    );
    const { data: appUsers, error: appUsersError } = await supabase
      .from("users")
      .select("name,bitrix_user_id")
      .eq("active", true)
      .not("bitrix_user_id", "is", null);
    if (appUsersError) throw new Error("Falha ao carregar usuários ativos do sistema.");

    const activeBitrixIds = new Set(
      (appUsers ?? []).map((user) => String(user.bitrix_user_id ?? "").trim()).filter(Boolean),
    );
    const bitrixUsers = await fetchActiveBitrixUsers();
    const kayla = bitrixUsers.find((user) => normalizeName(fullName(user)) === normalizeName("Kayla Freitas Morais"));
    const thalia = bitrixUsers.find((user) => normalizeName(fullName(user)) === normalizeName("Thalia Lourenço"));
    const kaylaId = String(kayla ? field(kayla, "id", "ID") : "").trim();
    const thaliaId = String(thalia ? field(thalia, "id", "ID") : "").trim();
    if (!kaylaId || !thaliaId) throw new Error("Kayla ou Thalia não foram localizadas no Bitrix.");

    const eligible = bitrixUsers
      .filter((user) => {
        const id = String(field(user, "id", "ID") ?? "").trim();
        const type = String(field(user, "user_type", "USER_TYPE") ?? "").toLowerCase();
        const birthday = parseBirthday(field(user, "personal_birthday", "PERSONAL_BIRTHDAY"));
        return activeBitrixIds.has(id) && type === "employee" && birthday?.month === targetMonth;
      })
      .map((user) => ({ user, birthday: parseBirthday(field(user, "personal_birthday", "PERSONAL_BIRTHDAY"))! }));

    const created: unknown[] = [];
    const skipped: unknown[] = [];
    const planned: unknown[] = [];
    const errors: unknown[] = [];

    for (const entry of eligible) {
      const name = fullName(entry.user);
      const celebration = { year: targetYear, month: targetMonth, day: entry.birthday.day };
      const cakeDue = shiftDate(targetYear, targetMonth, entry.birthday.day, -2);
      const artDue = shiftDate(targetYear, targetMonth, entry.birthday.day, -1);
      const birthDate = displayDate(entry.birthday.year, entry.birthday.month, entry.birthday.day);
      const celebrationDate = displayDate(celebration.year, celebration.month, celebration.day);
      const title = `🎂 [ANIVERSÁRIO | ${celebrationDate}] Preparativos — ${name}`;
      const checklist = [
        `${displayDate(cakeDue.year, cakeDue.month, cakeDue.day)} — Providenciar a compra/organização do bolo (2 dias antes)`,
        `${displayDate(artDue.year, artDue.month, artDue.day)} — Finalizar e programar a arte dos stories (1 dia antes)`,
      ];
      const description = [
        "LEMBRETE AUTOMÁTICO DE ANIVERSÁRIO",
        "",
        `Aniversariante: ${name}`,
        `Data de nascimento: ${birthDate}`,
        `Data da comemoração: ${celebrationDate}`,
        `Idade que completa: ${targetYear - entry.birthday.year} anos`,
        "",
        `Bolo: organizar até ${displayDate(cakeDue.year, cakeDue.month, cakeDue.day)}.` ,
        `Arte dos stories: finalizar até ${displayDate(artDue.year, artDue.month, artDue.day)}.` ,
        "",
        "Responsável: Kayla Freitas Morais",
        "Participante: Thalia Lourenço",
        "",
        "Tarefa gerada automaticamente pelo ISP Consulte Dashboard.",
      ].join("\n");

      try {
        const existing = await findExistingTask(title, kaylaId);
        const existingId = String(existing ? field(existing, "id", "ID") : "").trim();
        if (dryRun) {
          planned.push({ name, title, birthDate, celebrationDate, checklist, alreadyExists: Boolean(existingId) });
          continue;
        }

        const taskId = existingId || await addTask({
          title,
          description,
          deadline: `${isoDate(celebration.year, celebration.month, celebration.day)}T09:00:00-03:00`,
          responsibleId: kaylaId,
          accompliceId: thaliaId,
        });
        const checklistCreated = await ensureChecklist(taskId, checklist);
        if (existingId) skipped.push({ name, taskId, reason: "already_exists", checklistCreated });
        else created.push({ name, taskId, checklistCreated });
      } catch (error) {
        errors.push({ name, error: error instanceof Error ? error.message : "Erro inesperado." });
      }
    }

    return new Response(JSON.stringify({
      ok: errors.length === 0,
      dryRun,
      targetPeriod: `${targetYear}-${pad(targetMonth)}`,
      responsible: { id: kaylaId, name: fullName(kayla!) },
      participant: { id: thaliaId, name: fullName(thalia!) },
      eligible: eligible.length,
      planned,
      created,
      skipped,
      errors,
    }), { status: errors.length ? 207 : 200, headers: responseHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha na rotina de aniversários.";
    console.error("[create-birthday-reminders]", message);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: responseHeaders });
  }
});
