import {
  BIRTHDAY_TASK_TAGS,
  buildBirthdayTaskContract,
  cycleKey,
  parseBirthday,
  shouldRetryBitrixRequest,
  type Birthday,
  type BirthdayCycle,
} from "./birthday-task-contract.ts";

const BITRIX_BASE_URL =
  Deno.env.get("BITRIX_ADMIN_BASE_URL")?.trim()
  || Deno.env.get("BITRIX_BASE_URL")?.trim()
  || "";
const MAX_ATTEMPTS = 3;
const PROCESSING_STALE_MS = 5 * 60 * 1000;

export type BitrixUser = Record<string, unknown>;
export type BirthdayEmployee = {
  bitrixUserId: string;
  name: string;
  birthday: Birthday;
};
export type BirthdayContext = {
  employees: BirthdayEmployee[];
  responsibleId: string;
  participantId: string;
};
export type TaskTrigger = {
  source: "scheduled" | "manual";
  userId?: string | null;
  email?: string | null;
  forcedEarly?: boolean;
};

export function field(record: BitrixUser, lower: string, upper: string) {
  return record[upper] ?? record[lower];
}

export function normalizeList(value: unknown): BitrixUser[] {
  if (Array.isArray(value)) return value as BitrixUser[];
  if (value && typeof value === "object") return Object.values(value) as BitrixUser[];
  return [];
}

export function fullName(user: BitrixUser) {
  return `${String(field(user, "name", "NAME") ?? "")} ${String(field(user, "last_name", "LAST_NAME") ?? "")}`
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

async function requestBitrix(path: string, init: RequestInit) {
  if (!BITRIX_BASE_URL) throw new Error("BITRIX_BASE_URL não configurada.");
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(new URL(path, BITRIX_BASE_URL), {
        ...init,
        signal: AbortSignal.timeout(30_000),
      });
      const payload = await response.json().catch(() => null);
      const transient = shouldRetryBitrixRequest({
        status: response.status,
        errorCode: String(payload?.error ?? ""),
      });
      if (transient && attempt < MAX_ATTEMPTS - 1) {
        await delay(500 * 2 ** attempt);
        continue;
      }
      if (!response.ok || payload?.error) {
        const code = String(payload?.error ?? `HTTP_${response.status}`);
        throw new Error(`Bitrix recusou ${path}: ${code}`);
      }
      return payload;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Falha inesperada no Bitrix.");
      const transient = error instanceof TypeError || shouldRetryBitrixRequest({
        errorName: error instanceof Error ? error.name : "",
        errorMessage: lastError.message,
      });
      if (!transient || attempt === MAX_ATTEMPTS - 1) break;
      await delay(500 * 2 ** attempt);
    }
  }

  throw lastError ?? new Error("Falha ao acessar o Bitrix.");
}

export function bitrixPost(path: string, body: unknown) {
  return requestBitrix(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
}

export async function fetchActiveBitrixUsers() {
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

export async function loadBirthdayContext(supabase: any): Promise<BirthdayContext> {
  const { data: appUsers, error } = await supabase
    .from("users")
    .select("bitrix_user_id")
    .eq("active", true)
    .not("bitrix_user_id", "is", null);
  if (error) throw new Error("Falha ao carregar usuários ativos do sistema.");

  const activeIds = new Set(
    (appUsers ?? []).map((user: any) => String(user.bitrix_user_id ?? "").trim()).filter(Boolean),
  );
  const users = await fetchActiveBitrixUsers();
  const responsible = users.find((user) => normalizeName(fullName(user)) === normalizeName("Kayla Freitas Morais"));
  const participant = users.find((user) => normalizeName(fullName(user)) === normalizeName("Thalia Lourenço"));
  const responsibleId = String(responsible ? field(responsible, "id", "ID") : "").trim();
  const participantId = String(participant ? field(participant, "id", "ID") : "").trim();
  if (!responsibleId || !participantId) throw new Error("Kayla ou Thalia não foram localizadas no Bitrix.");

  const employees = users.flatMap((user): BirthdayEmployee[] => {
    const bitrixUserId = String(field(user, "id", "ID") ?? "").trim();
    const userType = String(field(user, "user_type", "USER_TYPE") ?? "").toLowerCase();
    const birthday = parseBirthday(field(user, "personal_birthday", "PERSONAL_BIRTHDAY"));
    const name = fullName(user);
    return activeIds.has(bitrixUserId) && userType === "employee" && birthday && name
      ? [{ bitrixUserId, name, birthday }]
      : [];
  });

  return { employees, responsibleId, participantId };
}

export async function ensureBirthdayTask(
  supabase: any,
  context: Pick<BirthdayContext, "responsibleId" | "participantId">,
  employee: BirthdayEmployee,
  cycle: BirthdayCycle,
  trigger: TaskTrigger,
) {
  const contract = buildBirthdayTaskContract(employee.name, employee.birthday, cycle);
  const identity = {
    bitrix_user_id: employee.bitrixUserId,
    employee_name: employee.name,
    birth_date: `${employee.birthday.year}-${String(employee.birthday.month).padStart(2, "0")}-${String(employee.birthday.day).padStart(2, "0")}`,
    cycle_year: cycle.year,
    cycle_month: cycle.month,
    title: contract.title,
  };

  const { error: insertError } = await supabase.from("birthday_task_cycles").insert({
    ...identity,
    trigger_source: trigger.source,
    triggered_by: trigger.userId ?? null,
    triggered_by_email: trigger.email ?? null,
    forced_early: Boolean(trigger.forcedEarly),
  });
  if (insertError && insertError.code !== "23505") {
    throw new Error("Falha ao reservar a identidade da tarefa de aniversário.");
  }

  const { data: existingRow, error: rowError } = await supabase
    .from("birthday_task_cycles")
    .select("*")
    .eq("bitrix_user_id", employee.bitrixUserId)
    .eq("cycle_year", cycle.year)
    .eq("cycle_month", cycle.month)
    .single();
  if (rowError || !existingRow) throw new Error("Falha ao consultar a identidade da tarefa de aniversário.");

  if (existingRow.status === "created" && existingRow.bitrix_task_id) {
    return { status: "already_exists" as const, taskId: String(existingRow.bitrix_task_id), contract };
  }
  const updatedAt = Date.parse(String(existingRow.updated_at ?? ""));
  if (existingRow.status === "processing" && Number.isFinite(updatedAt) && Date.now() - updatedAt < PROCESSING_STALE_MS) {
    return { status: "already_running" as const, taskId: null, contract };
  }

  const lockToken = crypto.randomUUID();
  const claimedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await supabase
    .from("birthday_task_cycles")
    .update({
      status: "processing",
      lock_token: lockToken,
      attempt_count: Number(existingRow.attempt_count ?? 0) + 1,
      last_error: null,
      trigger_source: trigger.source,
      triggered_by: trigger.userId ?? null,
      triggered_by_email: trigger.email ?? null,
      forced_early: Boolean(trigger.forcedEarly),
      updated_at: claimedAt,
    })
    .eq("id", existingRow.id)
    .eq("updated_at", existingRow.updated_at)
    .select("id")
    .maybeSingle();
  if (claimError) throw new Error("Falha ao iniciar a criação da tarefa de aniversário.");
  if (!claimed) return { status: "already_running" as const, taskId: null, contract };

  try {
    const existingTask = await findExistingTask(
      [contract.title, ...contract.legacyTitles],
      context.responsibleId,
    );
    const existingTaskId = String(existingTask ? field(existingTask, "id", "ID") : "").trim();
    const taskId = existingTaskId || await addTask({
      ...contract,
      responsibleId: context.responsibleId,
      participantId: context.participantId,
    });
    await ensureChecklist(taskId, contract.checklist);
    const { error: completeError } = await supabase
      .from("birthday_task_cycles")
      .update({
        status: "created",
        bitrix_task_id: taskId,
        created_in_bitrix_at: new Date().toISOString(),
        last_error: null,
        lock_token: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingRow.id)
      .eq("lock_token", lockToken);
    if (completeError) throw new Error("Tarefa criada, mas o estado local não pôde ser confirmado.");
    return { status: existingTaskId ? "already_exists" as const : "created" as const, taskId, contract };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    await supabase.from("birthday_task_cycles").update({
      status: "error",
      last_error: message,
      lock_token: null,
      updated_at: new Date().toISOString(),
    }).eq("id", existingRow.id).eq("lock_token", lockToken);
    throw error;
  }
}

async function findExistingTask(titles: string[], responsibleId: string) {
  const acceptedTitles = new Set(titles);
  let start = 0;
  for (let page = 0; page < 10; page += 1) {
    const payload = await bitrixPost("tasks.task.list.json", {
      order: { ID: "DESC" },
      filter: { RESPONSIBLE_ID: Number(responsibleId) },
      select: ["ID", "TITLE", "RESPONSIBLE_ID"],
      start,
    });
    const tasks = normalizeList(payload?.result?.tasks ?? payload?.result);
    const existing = tasks.find((task) => acceptedTitles.has(String(field(task, "title", "TITLE") ?? "")));
    if (existing) return existing;
    const next = Number(payload?.next);
    if (!Number.isFinite(next) || next <= start || tasks.length === 0) break;
    start = next;
  }
  return undefined;
}

async function addTask(params: {
  title: string;
  description: string;
  deadline: string;
  responsibleId: string;
  participantId: string;
}) {
  const body = new URLSearchParams();
  body.set("fields[TITLE]", params.title);
  body.set("fields[DESCRIPTION]", params.description);
  body.set("fields[RESPONSIBLE_ID]", params.responsibleId);
  body.set("fields[ACCOMPLICES][0]", params.participantId);
  body.set("fields[DEADLINE]", params.deadline);
  BIRTHDAY_TASK_TAGS.forEach((tag, index) => body.set(`fields[TAGS][${index}]`, tag));
  const payload = await requestBitrix("tasks.task.add.json", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: body.toString(),
  });
  const taskId = payload?.result?.task?.id ?? payload?.result?.id;
  if (!taskId) throw new Error("O Bitrix não confirmou a criação da tarefa.");
  return String(taskId);
}

async function ensureChecklist(taskId: string, titles: string[]) {
  const currentPayload = await bitrixPost("task.checklistitem.getlist.json", { TASKID: Number(taskId) });
  const currentTitles = new Set(
    normalizeList(currentPayload?.result).map((item) => String(field(item, "title", "TITLE") ?? "")),
  );
  for (let index = 0; index < titles.length; index += 1) {
    if (currentTitles.has(titles[index])) continue;
    await bitrixPost("task.checklistitem.add.json", {
      TASKID: Number(taskId),
      FIELDS: { TITLE: titles[index], SORT_INDEX: (index + 1) * 100, IS_COMPLETE: "N", IS_IMPORTANT: "Y" },
    });
  }
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function summarizeCycle(cycle: BirthdayCycle) {
  return cycleKey(cycle);
}
