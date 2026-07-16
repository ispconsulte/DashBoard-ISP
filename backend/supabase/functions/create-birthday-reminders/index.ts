import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildBirthdayTaskContract,
  cycleKey,
  cyclesToProcess,
  isCycleEligible,
  type BirthdayCycle,
} from "../_shared/birthday-task-contract.ts";
import {
  ensureBirthdayTask,
  loadBirthdayContext,
} from "../_shared/birthday-task-service.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const responseHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const SCHEDULER_KEY = "birthday-reminders";

type Actor = { userId: string; email: string | null };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: responseHeaders });
}

async function authenticateAdmin(req: Request, supabaseUrl: string, anonKey: string, serviceRoleKey: string): Promise<Actor | Response> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Não autorizado." }, 401);

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Sessão inválida." }, 401);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: user, error } = await adminClient
    .from("users")
    .select("role,user_profile,active,email")
    .eq("auth_user_id", authData.user.id)
    .maybeSingle();
  if (error) throw new Error("Não foi possível validar o administrador.");
  const role = String(user?.role ?? user?.user_profile ?? "").toLowerCase();
  if (!user || user.active === false || role !== "admin") {
    return json({ error: "Apenas administradores podem criar tarefas de aniversário." }, 403);
  }
  return { userId: authData.user.id, email: String(user.email ?? authData.user.email ?? "").trim() || null };
}

async function startRun(supabase: any, source: "scheduled" | "manual", actor: Actor | null, periods: BirthdayCycle[]) {
  const { data, error } = await supabase.from("birthday_automation_runs").insert({
    source,
    status: "running",
    requested_by: actor?.userId ?? null,
    requested_by_email: actor?.email ?? null,
    target_periods: periods.map(cycleKey),
  }).select("id").single();
  if (error) throw new Error("Falha ao registrar a execução da rotina de aniversários.");
  return String(data.id);
}

async function finishRun(
  supabase: any,
  runId: string,
  status: "success" | "partial" | "error" | "noop",
  summary: Record<string, unknown>,
  errorMessage: string | null = null,
) {
  const { error } = await supabase.from("birthday_automation_runs").update({
    status,
    finished_at: new Date().toISOString(),
    summary,
    error_message: errorMessage,
  }).eq("id", runId);
  if (error) console.error("[birthday-reminders] falha ao finalizar log operacional", error.message);
}

async function saveSchedulerState(
  supabase: any,
  input: {
    status: "running" | "success" | "partial" | "error" | "noop";
    summary?: Record<string, unknown>;
    completedCycle?: BirthdayCycle | null;
    finished?: boolean;
  },
) {
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    scheduler_key: SCHEDULER_KEY,
    last_status: input.status,
    last_summary: input.summary ?? {},
    updated_at: now,
  };
  if (input.status === "running") payload.last_started_at = now;
  if (input.finished) payload.last_finished_at = now;
  if (input.status === "success" || input.status === "noop") payload.last_success_at = now;
  if (input.completedCycle) payload.last_completed_cycle = `${cycleKey(input.completedCycle)}-01`;
  const { error } = await supabase.from("birthday_automation_state").upsert(payload, { onConflict: "scheduler_key" });
  if (error) throw new Error("Falha ao persistir o estado da rotina de aniversários.");
}

async function processCycle(
  supabase: any,
  context: Awaited<ReturnType<typeof loadBirthdayContext>>,
  cycle: BirthdayCycle,
  dryRun: boolean,
) {
  const employees = context.employees.filter((employee) => employee.birthday.month === cycle.month);
  const created: unknown[] = [];
  const skipped: unknown[] = [];
  const planned: unknown[] = [];
  const errors: unknown[] = [];

  for (const employee of employees) {
    if (dryRun) {
      const contract = buildBirthdayTaskContract(employee.name, employee.birthday, cycle);
      planned.push({ bitrixUserId: employee.bitrixUserId, name: employee.name, title: contract.title });
      continue;
    }
    try {
      const result = await ensureBirthdayTask(supabase, context, employee, cycle, { source: "scheduled" });
      const item = { bitrixUserId: employee.bitrixUserId, name: employee.name, taskId: result.taskId, status: result.status };
      if (result.status === "created") created.push(item);
      else skipped.push(item);
    } catch (error) {
      errors.push({
        bitrixUserId: employee.bitrixUserId,
        name: employee.name,
        error: error instanceof Error ? error.message : "Erro inesperado.",
      });
    }
  }

  return { period: cycleKey(cycle), eligible: employees.length, created, skipped, planned, errors };
}

async function runScheduled(supabase: any, body: Record<string, unknown>) {
  const dryRun = body.dry_run === true;
  const explicitMonth = Number(body.target_month);
  const explicitYear = Number(body.target_year);
  const hasExplicitCycle = Number.isInteger(explicitMonth) && explicitMonth >= 1 && explicitMonth <= 12 && Number.isInteger(explicitYear);

  const { data: state, error: stateError } = await supabase
    .from("birthday_automation_state")
    .select("last_completed_cycle")
    .eq("scheduler_key", SCHEDULER_KEY)
    .maybeSingle();
  if (stateError) throw new Error("Falha ao consultar o estado da rotina de aniversários.");

  const periods = hasExplicitCycle
    ? [{ year: explicitYear, month: explicitMonth }]
    : cyclesToProcess(state?.last_completed_cycle);
  const runId = await startRun(supabase, "scheduled", null, periods);
  if (!dryRun && !hasExplicitCycle) await saveSchedulerState(supabase, { status: "running" });

  try {
    const context = await loadBirthdayContext(supabase);
    const cycles = [];
    let lastCompleted: BirthdayCycle | null = null;
    for (const cycle of periods) {
      const result = await processCycle(supabase, context, cycle, dryRun);
      cycles.push(result);
      if (result.errors.length > 0) break;
      if (!dryRun && !hasExplicitCycle) lastCompleted = cycle;
    }
    const errors = cycles.flatMap((cycle) => cycle.errors);
    const created = cycles.flatMap((cycle) => cycle.created);
    const skipped = cycles.flatMap((cycle) => cycle.skipped);
    const planned = cycles.flatMap((cycle) => cycle.planned);
    const status = errors.length > 0 ? "partial" : created.length === 0 && planned.length === 0 ? "noop" : "success";
    const summary = { dryRun, periods: periods.map(cycleKey), cycles, created: created.length, skipped: skipped.length, errors: errors.length };
    await finishRun(supabase, runId, status, summary, errors.length ? "Uma ou mais tarefas falharam." : null);
    if (!dryRun && !hasExplicitCycle) {
      await saveSchedulerState(supabase, { status, summary, completedCycle: lastCompleted, finished: true });
    }
    console.info("[birthday-reminders] execução agendada concluída", { status, periods: summary.periods, created: created.length, errors: errors.length });
    return json({ ok: errors.length === 0, dryRun, status, ...summary }, errors.length ? 207 : 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha na rotina de aniversários.";
    await finishRun(supabase, runId, "error", {}, message);
    await saveSchedulerState(supabase, { status: "error", summary: { error: message }, finished: true }).catch(() => undefined);
    throw error;
  }
}

async function runManual(supabase: any, body: Record<string, unknown>, actor: Actor) {
  const bitrixUserId = String(body.bitrix_user_id ?? "").trim();
  const cycle = { year: Number(body.cycle_year), month: Number(body.cycle_month) };
  if (!bitrixUserId || !Number.isInteger(cycle.year) || !Number.isInteger(cycle.month) || cycle.month < 1 || cycle.month > 12) {
    return json({ error: "Colaborador ou ciclo de aniversário inválido." }, 400);
  }
  const { data: existingCycle, error: existingCycleError } = await supabase
    .from("birthday_task_cycles")
    .select("status,bitrix_task_id,employee_name")
    .eq("bitrix_user_id", bitrixUserId)
    .eq("cycle_year", cycle.year)
    .eq("cycle_month", cycle.month)
    .maybeSingle();
  if (existingCycleError) return json({ error: "Não foi possível verificar a tarefa existente." }, 500);
  if (existingCycle?.status === "created" && existingCycle.bitrix_task_id) {
    const runId = await startRun(supabase, "manual", actor, [cycle]);
    const summary = {
      employee: existingCycle.employee_name,
      cycle: cycleKey(cycle),
      taskId: String(existingCycle.bitrix_task_id),
      result: "already_exists",
      forcedEarly: false,
    };
    await finishRun(supabase, runId, "noop", summary);
    return json({ ok: true, ...summary });
  }
  if (existingCycle?.status === "processing") {
    const runId = await startRun(supabase, "manual", actor, [cycle]);
    const summary = {
      ok: true,
      employee: existingCycle.employee_name,
      cycle: cycleKey(cycle),
      taskId: null,
      result: "already_running",
      forcedEarly: false,
    };
    await finishRun(supabase, runId, "noop", summary);
    return json(summary, 202);
  }
  const forceEarly = body.force_early === true;
  if (!isCycleEligible(cycle) && !forceEarly) {
    return json({
      error: "Confirmação necessária para criação antecipada.",
      code: "EARLY_CONFIRMATION_REQUIRED",
      eligible: false,
    }, 409);
  }

  const runId = await startRun(supabase, "manual", actor, [cycle]);
  try {
    const context = await loadBirthdayContext(supabase);
    const employee = context.employees.find((item) => item.bitrixUserId === bitrixUserId);
    if (!employee) {
      await finishRun(supabase, runId, "error", {}, "Colaborador ativo não localizado no Bitrix.");
      return json({ error: "Colaborador ativo não localizado no Bitrix." }, 404);
    }
    const result = await ensureBirthdayTask(supabase, context, employee, cycle, {
      source: "manual",
      userId: actor.userId,
      email: actor.email,
      forcedEarly: forceEarly,
    });
    const status = result.status === "created" ? "success" : "noop";
    const summary = { employee: employee.name, cycle: cycleKey(cycle), taskId: result.taskId, result: result.status, forcedEarly: forceEarly };
    await finishRun(supabase, runId, status, summary);
    console.info("[birthday-reminders] criação manual concluída", { cycle: cycleKey(cycle), result: result.status });
    return json({ ok: true, ...summary }, result.status === "already_running" ? 202 : 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao criar a tarefa de aniversário.";
    await finishRun(supabase, runId, "error", {}, message);
    return json({ error: message }, /Bitrix/i.test(message) ? 502 : 500);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Configuração do servidor incompleta." }, 500);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action ?? "scheduled");
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    if (action === "scheduled") {
      if (req.headers.get("Authorization") !== `Bearer ${serviceRoleKey}`) return json({ error: "Não autorizado." }, 401);
      return await runScheduled(supabase, body);
    }
    if (action === "manual_create") {
      const actor = await authenticateAdmin(req, supabaseUrl, anonKey, serviceRoleKey);
      if (actor instanceof Response) return actor;
      return await runManual(supabase, body, actor);
    }
    return json({ error: "Ação inválida." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha na rotina de aniversários.";
    console.error("[birthday-reminders]", message);
    return json({ error: message }, 500);
  }
});
