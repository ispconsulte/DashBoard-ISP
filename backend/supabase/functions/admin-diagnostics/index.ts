import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXT_URL = "https://stubkeeuttixteqckshd.supabase.co";
const EXT_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0dWJrZWV1dHRpeHRlcWNrc2hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NjQ0OTIsImV4cCI6MjA3MzA0MDQ5Mn0.YcpSKrTSb1P1REC8lgkdduDITX52h_z7ArPD6XIkrlU";

const MANAGER_ROLES = new Set(["admin", "gerente", "coordenador"]);
const INTERNAL_PROJECT_ALIASES = ["sp", "isp", "interno", "internal"];
const VALID_ACTIONS = [
  "list",
  "upsert_task_control",
  "upsert_elapsed_control",
  "delete_task",
  "delete_elapsed",
] as const;

type Action = (typeof VALID_ACTIONS)[number];

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errRes(message: string, status = 400) {
  return jsonRes({ ok: false, error: message }, status);
}

function validateString(value: unknown, maxLen = 2000): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().slice(0, maxLen);
  return normalized.length ? normalized : null;
}

function validateBigintId(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isBlank(value: unknown) {
  return String(value ?? "").trim() === "";
}

function parseDate(value: unknown) {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIsoOrNull(value: unknown) {
  const parsed = parseDate(value);
  return parsed ? parsed.toISOString() : null;
}

async function resolveCallerRole(adminClient: SupabaseClient, uid: string): Promise<string | null> {
  const { data: roleRows } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", uid)
    .limit(1);

  if (roleRows?.[0]?.role) return roleRows[0].role;

  const { data: userRows } = await adminClient
    .from("users")
    .select("user_profile")
    .eq("auth_user_id", uid)
    .limit(1);

  const profile = normalizeText(userRows?.[0]?.user_profile);
  if (profile === "administrador") return "admin";
  if (profile === "gerente") return "gerente";
  if (profile === "coordenador") return "coordenador";
  return null;
}

async function fetchAllRows(
  client: SupabaseClient,
  table: string,
  select: string,
  orderBy: string,
  filters?: (query: any) => any,
) {
  const rows: any[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    let query = client.from(table).select(select).order(orderBy, { ascending: true }).range(from, from + pageSize - 1);
    if (filters) query = filters(query);
    const { data, error } = await query;
    if (error) throw new Error(`Erro ao carregar ${table}: ${error.message}`);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

function summarizeTaskProblems(task: any) {
  const problems: Array<{ code: string; label: string; meaning: string; severity: number }> = [];
  const title = validateString(task.title, 400);
  const responsible = validateString(task.responsible_name, 200);
  const projectId = validateBigintId(task.project_id);
  const projectName = validateString(task.projects?.name ?? task.group_name ?? task.project_name, 200);
  const normalizedProjectName = normalizeText(projectName);
  const deadline = parseDate(task.deadline);
  const missingFromBitrixSince = parseDate(task.missing_from_bitrix_since);
  const isInternalAlias = !projectId && INTERNAL_PROJECT_ALIASES.some((alias) =>
    normalizedProjectName === alias || normalizedProjectName === `${alias} consulte`
  );

  if (missingFromBitrixSince) {
    problems.push({
      code: "missing_from_source",
      label: "Fora da base principal",
      meaning: "A atividade deixou de aparecer na sincronização principal. Normalmente isso indica remoção, arquivamento ou mudança na origem.",
      severity: 100,
    });
  }

  if (!projectId || isInternalAlias) {
    problems.push({
      code: "missing_project",
      label: "Sem projeto válido",
      meaning: "A atividade está sem vínculo operacional de projeto. Assim, ela perde contexto em gestão, relatórios e painéis.",
      severity: 90,
    });
  }

  if (!title) {
    problems.push({
      code: "missing_title",
      label: "Sem nome",
      meaning: "A atividade chegou sem título claro, o que dificulta revisão, acompanhamento e auditoria.",
      severity: 80,
    });
  }

  if (!responsible) {
    problems.push({
      code: "missing_responsible",
      label: "Sem responsável",
      meaning: "A atividade não tem responsável definido localmente, então ela não deveria entrar no fluxo operacional normal.",
      severity: 70,
    });
  }

  if (!deadline) {
    problems.push({
      code: "missing_deadline",
      label: "Sem prazo",
      meaning: "A atividade está sem data de entrega. Isso reduz a confiança de atrasos, prioridades e acompanhamento de rotina.",
      severity: 60,
    });
  }

  return {
    problems,
    severity: problems.reduce((max, item) => Math.max(max, item.severity), 0),
    isProblematic: problems.length > 0,
    projectName,
  };
}

function summarizeElapsedProblem(entry: any) {
  const rawTaskId = validateBigintId(entry.bitrix_task_id_raw);
  return {
    label: "Horas sem tarefa associada",
    meaning: rawTaskId
      ? "Esse lançamento de horas chegou apontando para uma tarefa que não existe mais no retrato local. Pode indicar exclusão, arquivamento ou atraso de sincronização."
      : "Esse lançamento de horas chegou sem uma tarefa associada válida, então ele não deve alimentar relatórios operacionais.",
  };
}

async function loadDiagnostics(adminClient: SupabaseClient) {
  const [tasks, taskControls, elapsedTimes, elapsedControls, syncConfigs, syncRuns] = await Promise.all([
    fetchAllRows(
      adminClient,
      "tasks",
      "task_id,title,status,deadline,closed_date,group_name,responsible_name,project_id,updated_at,inserted_at,last_seen_in_bitrix_at,missing_from_bitrix_since,projects(name,cliente_id)",
      "task_id",
    ),
    fetchAllRows(
      adminClient,
      "task_diagnostic_controls",
      "task_id,visibility_mode,review_status,admin_note,updated_by,updated_at,created_at",
      "task_id",
    ),
    fetchAllRows(
      adminClient,
      "elapsed_times",
      "id,task_id,bitrix_task_id_raw,orphan_reason,orphan_detected_at,created_date,date_start,date_stop,minutes,seconds,comment_text,updated_at",
      "id",
      (query) => query.not("orphan_reason", "is", null),
    ),
    fetchAllRows(
      adminClient,
      "elapsed_diagnostic_controls",
      "elapsed_id,visibility_mode,review_status,admin_note,updated_by,updated_at,created_at",
      "elapsed_id",
    ),
    adminClient
      .from("sync_job_configs")
      .select("job_name,cron_expression,enabled,last_scheduled_at,last_job_id,updated_at")
      .order("job_name", { ascending: true }),
    adminClient
      .from("sync_job_runs")
      .select("job_name,status,triggered_by,started_at,finished_at,duration_ms,error_message,details")
      .order("started_at", { ascending: false })
      .limit(12),
  ]);

  if (syncConfigs.error) throw new Error(`Erro ao carregar agendamentos: ${syncConfigs.error.message}`);
  if (syncRuns.error) throw new Error(`Erro ao carregar execucoes: ${syncRuns.error.message}`);

  const taskControlMap = new Map((taskControls ?? []).map((row: any) => [Number(row.task_id), row]));
  const elapsedControlMap = new Map((elapsedControls ?? []).map((row: any) => [Number(row.elapsed_id), row]));

  const problematicTasks = (tasks ?? [])
    .map((task: any) => {
      const summary = summarizeTaskProblems(task);
      if (!summary.isProblematic) return null;
      const control = taskControlMap.get(Number(task.task_id)) ?? null;
      return {
        task_id: Number(task.task_id),
        title: validateString(task.title, 400) ?? "Sem nome definido",
        status: task.status ?? null,
        responsible_name: validateString(task.responsible_name, 200),
        deadline: toIsoOrNull(task.deadline),
        closed_date: toIsoOrNull(task.closed_date),
        project_id: validateBigintId(task.project_id),
        project_name: summary.projectName,
        inserted_at: toIsoOrNull(task.inserted_at),
        updated_at: toIsoOrNull(task.updated_at),
        last_seen_in_bitrix_at: toIsoOrNull(task.last_seen_in_bitrix_at),
        missing_from_bitrix_since: toIsoOrNull(task.missing_from_bitrix_since),
        problems: summary.problems,
        severity: summary.severity,
        visibility_mode: control?.visibility_mode ?? "diagnostic_only",
        review_status: control?.review_status ?? "pending",
        admin_note: control?.admin_note ?? null,
        control_updated_at: control?.updated_at ?? null,
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => b.severity - a.severity || String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")));

  const orphanElapsed = (elapsedTimes ?? [])
    .map((entry: any) => {
      const control = elapsedControlMap.get(Number(entry.id)) ?? null;
      const summary = summarizeElapsedProblem(entry);
      return {
        id: Number(entry.id),
        task_id: validateBigintId(entry.task_id),
        bitrix_task_id_raw: validateBigintId(entry.bitrix_task_id_raw),
        orphan_reason: validateString(entry.orphan_reason, 300),
        orphan_detected_at: toIsoOrNull(entry.orphan_detected_at),
        created_date: toIsoOrNull(entry.created_date),
        date_start: toIsoOrNull(entry.date_start),
        date_stop: toIsoOrNull(entry.date_stop),
        updated_at: toIsoOrNull(entry.updated_at),
        minutes: Number(entry.minutes ?? 0),
        seconds: Number(entry.seconds ?? 0),
        comment_text: validateString(entry.comment_text, 500),
        label: summary.label,
        meaning: summary.meaning,
        visibility_mode: control?.visibility_mode ?? "diagnostic_only",
        review_status: control?.review_status ?? "pending",
        admin_note: control?.admin_note ?? null,
        control_updated_at: control?.updated_at ?? null,
      };
    })
    .sort((a: any, b: any) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")));

  const latestTasksRun = (syncRuns.data ?? []).find((row: any) => row.job_name === "Get-Projetcs-And-Tasks-Bitrix") ?? null;
  const latestTimesRun = (syncRuns.data ?? []).find((row: any) => row.job_name === "sync-bitrix-times") ?? null;

  return {
    overview: {
      total_tasks: tasks.length,
      problematic_tasks: problematicTasks.length,
      projectless_tasks: problematicTasks.filter((task: any) => task.problems.some((problem: any) => problem.code === "missing_project")).length,
      missing_from_source_tasks: problematicTasks.filter((task: any) => task.problems.some((problem: any) => problem.code === "missing_from_source")).length,
      incomplete_tasks: problematicTasks.filter((task: any) =>
        task.problems.some((problem: any) => ["missing_title", "missing_responsible", "missing_deadline"].includes(problem.code))
      ).length,
      hidden_from_operations: problematicTasks.filter((task: any) => task.visibility_mode !== "show_in_operations").length,
      orphan_elapsed_entries: orphanElapsed.length,
    },
    sync: {
      configs: syncConfigs.data ?? [],
      latest_tasks_run: latestTasksRun,
      latest_times_run: latestTimesRun,
      recent_runs: syncRuns.data ?? [],
    },
    problematic_tasks: problematicTasks,
    orphan_elapsed: orphanElapsed,
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errRes("Nao autorizado.", 401);
    }

    const extServiceRoleKey = Deno.env.get("EXT_SUPABASE_SERVICE_ROLE_KEY");
    if (!extServiceRoleKey) {
      return errRes("Configuracao do servidor incompleta.", 500);
    }

    const token = authHeader.replace("Bearer ", "");
    const callerClient = createClient(EXT_URL, EXT_ANON, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await callerClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return errRes("Token invalido.", 401);
    }

    const callerUid = userData.user.id;
    const adminClient = createClient(EXT_URL, extServiceRoleKey);
    const callerRole = await resolveCallerRole(adminClient, callerUid);

    if (!callerRole || !MANAGER_ROLES.has(callerRole)) {
      return errRes("Apenas gestores podem acessar a central de integridade.", 403);
    }

    let body: Record<string, unknown> = {};
    if (req.method !== "GET") {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    const action = (body.action as Action | undefined) ?? "list";
    if (!VALID_ACTIONS.includes(action)) {
      return errRes(`Acao invalida: ${String(action)}`, 400);
    }

    if (action === "list") {
      const data = await loadDiagnostics(adminClient);
      return jsonRes({ ok: true, data });
    }

    if (action === "upsert_task_control") {
      const taskId = validateBigintId(body.task_id);
      const visibilityMode = validateString(body.visibility_mode, 40) ?? "diagnostic_only";
      const reviewStatus = validateString(body.review_status, 40) ?? "pending";
      const adminNote = validateString(body.admin_note);

      if (!taskId) return errRes("task_id e obrigatorio.");

      const { error } = await adminClient
        .from("task_diagnostic_controls")
        .upsert({
          task_id: taskId,
          visibility_mode: visibilityMode,
          review_status: reviewStatus,
          admin_note: adminNote,
          updated_by: callerUid,
        }, { onConflict: "task_id" });

      if (error) return errRes(`Falha ao salvar controle da tarefa: ${error.message}`, 500);

      const data = await loadDiagnostics(adminClient);
      return jsonRes({ ok: true, data });
    }

    if (action === "upsert_elapsed_control") {
      const elapsedId = validateBigintId(body.elapsed_id);
      const visibilityMode = validateString(body.visibility_mode, 40) ?? "diagnostic_only";
      const reviewStatus = validateString(body.review_status, 40) ?? "pending";
      const adminNote = validateString(body.admin_note);

      if (!elapsedId) return errRes("elapsed_id e obrigatorio.");

      const { error } = await adminClient
        .from("elapsed_diagnostic_controls")
        .upsert({
          elapsed_id: elapsedId,
          visibility_mode: visibilityMode,
          review_status: reviewStatus,
          admin_note: adminNote,
          updated_by: callerUid,
        }, { onConflict: "elapsed_id" });

      if (error) return errRes(`Falha ao salvar controle do lancamento: ${error.message}`, 500);

      const data = await loadDiagnostics(adminClient);
      return jsonRes({ ok: true, data });
    }

    if (action === "delete_task") {
      const taskId = validateBigintId(body.task_id);
      if (!taskId) return errRes("task_id e obrigatorio.");

      const { error: elapsedError } = await adminClient
        .from("elapsed_times")
        .delete()
        .eq("task_id", taskId);
      if (elapsedError) return errRes(`Falha ao limpar horas vinculadas: ${elapsedError.message}`, 500);

      const { error: controlError } = await adminClient
        .from("task_diagnostic_controls")
        .delete()
        .eq("task_id", taskId);
      if (controlError) return errRes(`Falha ao limpar controle da tarefa: ${controlError.message}`, 500);

      const { error } = await adminClient
        .from("tasks")
        .delete()
        .eq("task_id", taskId);
      if (error) return errRes(`Falha ao excluir tarefa local: ${error.message}`, 500);

      const data = await loadDiagnostics(adminClient);
      return jsonRes({ ok: true, data });
    }

    if (action === "delete_elapsed") {
      const elapsedId = validateBigintId(body.elapsed_id);
      if (!elapsedId) return errRes("elapsed_id e obrigatorio.");

      const { error: controlError } = await adminClient
        .from("elapsed_diagnostic_controls")
        .delete()
        .eq("elapsed_id", elapsedId);
      if (controlError) return errRes(`Falha ao limpar controle do lancamento: ${controlError.message}`, 500);

      const { error } = await adminClient
        .from("elapsed_times")
        .delete()
        .eq("id", elapsedId);
      if (error) return errRes(`Falha ao excluir lancamento local: ${error.message}`, 500);

      const data = await loadDiagnostics(adminClient);
      return jsonRes({ ok: true, data });
    }

    return errRes("Acao nao tratada.", 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errRes(message || "Falha inesperada.", 500);
  }
});
