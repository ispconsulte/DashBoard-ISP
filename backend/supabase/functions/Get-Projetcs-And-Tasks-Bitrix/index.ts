import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BITRIX_BASE_URL = Deno.env.get('BITRIX_ADMIN_BASE_URL') ?? Deno.env.get('BITRIX_BASE_URL'); 
const RETRIES = 4;
const DELAY_MS = 250;
const SYNC_JOB_NAME = 'Get-Projetcs-And-Tasks-Bitrix';
const SOURCE_CODE = 'bitrix_tasks';
const SOURCE_NAME = 'Bitrix Tasks + Projects';
const SOURCE_ENTITY = 'tasks';
const RUN_STALE_AFTER_MS = 3 * 60 * 60 * 1000;
const TASK_STALE_AFTER_MS = 24 * 60 * 60 * 1000;
const BONUS_CALCULATION_VERSION = 'edge-bonus-writer-v1';
const CONSULTANT_MAX_BONUS: Record<string, number> = {
  junior: 1000,
  pleno: 2000,
  senior: 3500,
  'nao definido': 1200,
};

function normalizeList(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'object') return Object.values(data);
  return [];
}

function getField(item: any, lowerKey: string, upperKey: string) {
  if (item[lowerKey] !== undefined && item[lowerKey] !== null) return item[lowerKey];
  if (item[upperKey] !== undefined && item[upperKey] !== null) return item[upperKey];
  return null;
}

function toInt(value: any): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function toIso(value: any): string | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function nonEmptyString(value: any): string | null {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str === '' ? null : str;
}

function toNumber(value: any): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function quarterKey(date: Date) {
  return `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
}

function startOfQuarter(date: Date) {
  return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
}

function endOfQuarter(date: Date) {
  return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3 + 3, 0, 23, 59, 59, 999);
}

function normalizeName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeLevel(level: string | null) {
  const normalized = String(level ?? '').trim().toLowerCase();
  if (normalized === 'senior') return 'senior';
  if (normalized === 'pleno') return 'pleno';
  if (normalized === 'junior') return 'junior';
  return 'nao definido';
}

function maxBonusForLevel(level: string | null) {
  return CONSULTANT_MAX_BONUS[normalizeLevel(level)] ?? CONSULTANT_MAX_BONUS['nao definido'];
}

function parseDateValue(value: any): Date | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getElapsedEffectiveDate(value: {
  date_start?: any;
  created_date?: any;
  inserted_at?: any;
  updated_at?: any;
}) {
  return (
    parseDateValue(value.date_start) ||
    parseDateValue(value.created_date) ||
    parseDateValue(value.inserted_at) ||
    parseDateValue(value.updated_at)
  );
}

function isWithinRange(value: Date | null, start: Date, end: Date) {
  if (!value) return false;
  return value >= start && value <= end;
}

function calcHealthScore(
  ebitda: number | null,
  churn: number | null,
  nps: number | null,
  benchmarks: { ebitda: number; churn: number; nps: number } | null,
  weights: { ebitda: number; churn: number; nps: number },
) {
  const b = benchmarks ?? { ebitda: 100000, churn: 5, nps: 50 };
  let score = 0;
  let totalWeight = 0;

  if (ebitda != null && b.ebitda > 0) {
    const ratio = Math.min(ebitda / b.ebitda, 2) * 50;
    score += ratio * weights.ebitda;
    totalWeight += weights.ebitda;
  }
  if (churn != null && b.churn > 0) {
    const ratio = Math.max(0, Math.min(100, (1 - churn / (b.churn * 2)) * 100));
    score += ratio * weights.churn;
    totalWeight += weights.churn;
  }
  if (nps != null) {
    const normalized = Math.max(0, Math.min(100, ((nps + 100) / 200) * 100));
    score += normalized * weights.nps;
    totalWeight += weights.nps;
  }

  if (totalWeight === 0) return null;
  return Math.round((score / totalWeight) * 10) / 10;
}

function consultantScoreFromMetrics(metrics: {
  onTimeRate: number | null;
  overdueRate: number | null;
  utilization: number | null;
  healthScore: number | null;
}) {
  const onTimeScore = metrics.onTimeRate != null ? clamp(metrics.onTimeRate / 95) : 0.55;
  const overdueScore = metrics.overdueRate != null ? clamp(1 - metrics.overdueRate / 30) : 0.6;

  let utilizationScore = 0.6;
  if (metrics.utilization != null) {
    const utilization = metrics.utilization;
    if (utilization >= 70 && utilization <= 95) utilizationScore = 1;
    else if (utilization < 70) utilizationScore = clamp(utilization / 70);
    else utilizationScore = clamp(1 - (utilization - 95) / 45);
  }

  const healthScore = metrics.healthScore != null ? clamp(metrics.healthScore / 80) : 0.65;

  return clamp(
    onTimeScore * 0.38 +
      overdueScore * 0.22 +
      utilizationScore * 0.2 +
      healthScore * 0.2,
  );
}

async function fetchAllRows(
  supabase: any,
  table: string,
  select: string,
  orderBy = 'id',
  ascending = true,
) {
  const rows: any[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order(orderBy, { ascending })
      .range(from, to);

    if (error) {
      throw new Error(`Erro ao carregar ${table}: ${error.message}`);
    }

    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

function keepBest<T>(incoming: T | null | undefined, existing: T | null | undefined) {
  if (incoming === undefined || incoming === null) return existing ?? null;
  if (typeof incoming === 'string' && incoming.trim() === '') return existing ?? incoming;
  return incoming;
}

function toBool(value: any) {
  return String(value ?? '').trim().toUpperCase() === 'Y';
}

async function fetchJsonWithRetry(url: string) {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`HTTP ${response.status}`);
        await new Promise((r) => setTimeout(r, DELAY_MS * (attempt + 1)));
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      return await response.json();
    } catch (error: any) {
      lastError = error;
      if (attempt === RETRIES - 1) break;
      await new Promise((r) => setTimeout(r, DELAY_MS * (attempt + 1)));
    }
  }

  throw lastError ?? new Error('Falha ao buscar dados do Bitrix.');
}

async function bitrixPostWithRetry(path: string, body: unknown) {
  if (!BITRIX_BASE_URL) {
    throw new Error('A BITRIX_BASE_URL não foi configurada nos Secrets.');
  }

  const endpoint = new URL(path, BITRIX_BASE_URL).toString();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`HTTP ${response.status}`);
        await new Promise((r) => setTimeout(r, DELAY_MS * (attempt + 1)));
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      if (data.error && !data.result) {
        throw new Error(String(data.error_description || data.error));
      }
      return data;
    } catch (error: any) {
      lastError = error;
      if (attempt === RETRIES - 1) break;
      await new Promise((r) => setTimeout(r, DELAY_MS * (attempt + 1)));
    }
  }

  throw lastError ?? new Error('Falha ao buscar dados do Bitrix.');
}

async function getLastTaskSyncCursor(supabase: any) {
  const { data, error } = await supabase
    .from('bonus_source_statuses')
    .select('details,last_success_at')
    .eq('source_code', SOURCE_CODE)
    .maybeSingle();

  if (error) {
    console.error('Falha ao ler cursor incremental de tarefas:', error.message);
    return null;
  }

  const details = (data?.details ?? {}) as Record<string, unknown>;
  const changedSince = toIso(details.last_incremental_changed_date ?? data?.last_success_at);
  return changedSince;
}

async function fetchIncrementalTaskPages(sinceIso: string | null) {
  if (!BITRIX_BASE_URL) {
    throw new Error("A BITRIX_BASE_URL não foi configurada nos Secrets.");
  }

  if (!sinceIso) {
    const allTasks: any[] = [];
    let start = 0;
    let hasMore = true;

    while (hasMore) {
      const taskUrl = new URL('tasks.task.list.json', BITRIX_BASE_URL);
      taskUrl.searchParams.append('start', String(start));
      [
        'ID',
        'TITLE',
        'DESCRIPTION',
        'STATUS',
        'DEADLINE',
        'CLOSED_DATE',
        'GROUP_ID',
        'RESPONSIBLE_ID',
        'CREATED_BY',
        'CREATED_DATE',
        'CHANGED_DATE',
      ].forEach((field) => taskUrl.searchParams.append('select[]', field));

      const data = await fetchJsonWithRetry(taskUrl.toString());
      const tasks = normalizeList(data.result?.tasks || data.result || []);
      allTasks.push(...tasks);

      if (data.next) {
        start = data.next;
        await new Promise((r) => setTimeout(r, DELAY_MS));
      } else {
        hasMore = false;
      }
    }

    return { mode: 'full' as const, pages: allTasks };
  }

  const filters = [
    { key: '>=CHANGED_DATE', value: sinceIso },
    { key: '>=ACTIVITY_DATE', value: sinceIso },
  ];

  const byTaskId = new Map<number, any>();
  for (const filter of filters) {
    let start = 0;
    let hasMore = true;
    while (hasMore) {
      const taskUrl = new URL('tasks.task.list.json', BITRIX_BASE_URL);
      taskUrl.searchParams.append('start', String(start));
      taskUrl.searchParams.append(`filter[${filter.key}]`, filter.value);
      [
        'ID',
        'TITLE',
        'DESCRIPTION',
        'STATUS',
        'DEADLINE',
        'CLOSED_DATE',
        'GROUP_ID',
        'RESPONSIBLE_ID',
        'CREATED_BY',
        'CREATED_DATE',
        'CHANGED_DATE',
      ].forEach((field) => taskUrl.searchParams.append('select[]', field));

      const data = await fetchJsonWithRetry(taskUrl.toString());
      const tasks = normalizeList(data.result?.tasks || data.result || []);
      for (const task of tasks) {
        const taskId = toInt(getField(task, 'id', 'ID'));
        if (taskId) byTaskId.set(taskId, task);
      }

      if (data.next) {
        start = data.next;
        await new Promise((r) => setTimeout(r, DELAY_MS));
      } else {
        hasMore = false;
      }
    }
  }

  return { mode: 'incremental' as const, pages: Array.from(byTaskId.values()) };
}

async function fetchBitrixTaskById(taskId: number) {
  const data = await bitrixPostWithRetry('tasks.task.get.json', {
    taskId,
    select: [
      'ID',
      'TITLE',
      'DESCRIPTION',
      'STATUS',
      'DEADLINE',
      'CLOSED_DATE',
      'GROUP_ID',
      'RESPONSIBLE_ID',
      'CREATED_DATE',
      'CHANGED_DATE',
    ],
  });

  const task = data?.result?.task ?? data?.result ?? null;
  if (!task || (Array.isArray(task) && task.length === 0)) {
    return null;
  }
  return task;
}

async function fetchExistingTasksMap(supabase: any, taskIds: number[]) {
  const existing = new Map<number, any>();
  if (!taskIds.length) return existing;

  for (let offset = 0; offset < taskIds.length; offset += 500) {
    const slice = taskIds.slice(offset, offset + 500);
    const { data, error } = await supabase
      .from('tasks')
      .select('task_id,title,description,status,real_status,deadline,closed_date,changed_date,group_id,group_name,responsible_id,responsible_name,project_id,last_seen_at,last_seen_in_bitrix_at,missing_from_bitrix_since,bitrix_visible,project_closed,local_state')
      .in('task_id', slice);

    if (error) throw new Error(`Erro ao carregar tarefas existentes: ${error.message}`);
    for (const row of data ?? []) {
      const taskId = toInt((row as any).task_id);
      if (taskId) existing.set(taskId, row);
    }
  }

  return existing;
}

function mergeTaskRecord(incoming: any, existing?: any) {
  if (!existing) return incoming;

  return {
    task_id: incoming.task_id,
    title: keepBest(incoming.title, existing.title) ?? `Tarefa ${incoming.task_id}`,
    description: keepBest(incoming.description, existing.description) ?? '',
    status: keepBest(incoming.status, existing.status),
    real_status: keepBest(incoming.real_status, existing.real_status ?? existing.status),
    deadline: keepBest(incoming.deadline, existing.deadline),
    closed_date: keepBest(incoming.closed_date, existing.closed_date),
    changed_date: keepBest(incoming.changed_date, existing.changed_date),
    group_id: keepBest(incoming.group_id, existing.group_id),
    group_name: keepBest(incoming.group_name, existing.group_name),
    responsible_id: keepBest(incoming.responsible_id, existing.responsible_id),
    responsible_name: keepBest(incoming.responsible_name, existing.responsible_name),
    updated_at: incoming.updated_at,
    project_id: keepBest(incoming.project_id, existing.project_id),
    last_seen_at: keepBest(incoming.last_seen_at, existing.last_seen_at),
    last_seen_in_bitrix_at: keepBest(incoming.last_seen_in_bitrix_at, existing.last_seen_in_bitrix_at),
    missing_from_bitrix_since: keepBest(incoming.missing_from_bitrix_since, existing.missing_from_bitrix_since),
    bitrix_visible: keepBest(incoming.bitrix_visible, existing.bitrix_visible ?? true),
    project_closed: keepBest(incoming.project_closed, existing.project_closed ?? false),
    local_state: keepBest(incoming.local_state, existing.local_state ?? 'active'),
  };
}

async function fetchAllDbTaskIds(supabase: any) {
  const taskIds: number[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('tasks')
      .select('task_id')
      .range(from, to);

    if (error) throw new Error(`Erro ao carregar IDs de tarefas do banco: ${error.message}`);

    const rows = (data ?? []) as Array<{ task_id?: number | string | null }>;
    for (const row of rows) {
      const taskId = toInt(row.task_id);
      if (taskId) taskIds.push(taskId);
    }

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return taskIds;
}

async function markMissingTasks(supabase: any, seenTaskIds: Set<number>, syncStartedAtIso: string) {
  const dbTaskIds = await fetchAllDbTaskIds(supabase);
  const missingTaskIds = dbTaskIds.filter((taskId) => !seenTaskIds.has(taskId));

  for (let offset = 0; offset < missingTaskIds.length; offset += 500) {
    const slice = missingTaskIds.slice(offset, offset + 500);
    const { error } = await supabase
      .from('tasks')
      .update({ missing_from_bitrix_since: syncStartedAtIso })
      .in('task_id', slice)
      .is('missing_from_bitrix_since', null);

    if (error) {
      throw new Error(`Erro ao marcar tarefas ausentes no Bitrix: ${error.message}`);
    }
  }

  return missingTaskIds.length;
}

async function fetchDeleteTombstones(supabase: any) {
  const tombstones = new Map<number, any>();
  const rows = await fetchAllRows(
    supabase,
    'bitrix_task_delete_events',
    'task_id,deleted_at,received_at,event_name',
    'task_id',
  );

  for (const row of rows ?? []) {
    const taskId = toInt((row as any).task_id);
    if (taskId) tombstones.set(taskId, row);
  }
  return tombstones;
}

async function fetchTasksForReconciliation(supabase: any) {
  return await fetchAllRows(
    supabase,
    'tasks',
    'task_id,title,status,real_status,deadline,closed_date,changed_date,group_id,group_name,responsible_id,responsible_name,project_id,last_seen_at,last_seen_in_bitrix_at,missing_from_bitrix_since,bitrix_visible,project_closed,local_state',
    'task_id',
  );
}

async function createSyncRun(supabase: any, details: Record<string, unknown>) {
  const staleBeforeIso = new Date(Date.now() - RUN_STALE_AFTER_MS).toISOString();

  const { error: staleError } = await supabase
    .from('sync_job_runs')
    .update({
      status: 'error',
      finished_at: new Date().toISOString(),
      error_message: 'Marked stale before a new scheduled run started.',
    })
    .eq('job_name', SYNC_JOB_NAME)
    .eq('status', 'running')
    .lt('started_at', staleBeforeIso);

  if (staleError) {
    console.error('Falha ao encerrar runs antigos:', staleError.message);
  }

  const { data: runningRows, error: runningError } = await supabase
    .from('sync_job_runs')
    .select('id, started_at')
    .eq('job_name', SYNC_JOB_NAME)
    .eq('status', 'running')
    .order('started_at', { ascending: false })
    .limit(1);

  if (runningError) {
    console.error('Falha ao verificar run em andamento:', runningError.message);
  }

  const activeRun = (runningRows ?? [])[0] ?? null;
  if (activeRun) {
    return {
      runId: null,
      skipped: true,
      skipReason: `Run already active since ${activeRun.started_at}`,
    };
  }

  const payload = {
    job_name: SYNC_JOB_NAME,
    status: 'running',
    triggered_by: 'edge_function',
    source: SOURCE_CODE,
    details,
  };

  const { data, error } = await supabase
    .from('sync_job_runs')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    console.error('Falha ao criar sync_job_runs:', error.message);
    if (error.code === '23505') {
      return {
        runId: null,
        skipped: true,
        skipReason: 'Another scheduler invocation acquired the running slot first.',
      };
    }
    return { runId: null, skipped: false, skipReason: null };
  }

  return {
    runId: data?.id ?? null,
    skipped: false,
    skipReason: null,
  };
}

async function finishSyncRun(
  supabase: any,
  runId: string | null,
  status: 'success' | 'error',
  startedAt: number,
  details: Record<string, unknown>,
  errorMessage?: string | null,
  recordsProcessed?: number | null,
) {
  if (!runId) return;

  const payload = {
    status,
    source: SOURCE_CODE,
    finished_at: new Date().toISOString(),
    duration_ms: Date.now() - startedAt,
    records_processed: recordsProcessed ?? null,
    error_message: errorMessage ?? null,
    details,
  };

  const { error } = await supabase
    .from('sync_job_runs')
    .update(payload)
    .eq('id', runId);

  if (error) {
    console.error('Falha ao finalizar sync_job_runs:', error.message);
  }
}

async function logSkippedRun(supabase: any, details: Record<string, unknown>, errorMessage: string) {
  const { error } = await supabase
    .from('sync_job_runs')
    .insert({
      job_name: SYNC_JOB_NAME,
      status: 'skipped',
      triggered_by: 'edge_function',
      source: SOURCE_CODE,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      duration_ms: 0,
      records_processed: 0,
      error_message: errorMessage,
      details,
    });

  if (error) {
    console.error('Falha ao registrar run skipped:', error.message);
  }
}

async function upsertSourceStatus(
  supabase: any,
  status: 'running' | 'success' | 'partial' | 'error',
  details: Record<string, unknown>,
  lastError?: string | null,
) {
  const nowIso = new Date().toISOString();
  const payload: Record<string, unknown> = {
    source_code: SOURCE_CODE,
    source_name: SOURCE_NAME,
    source_kind: 'bitrix',
    entity_name: SOURCE_ENTITY,
    sync_status: status,
    last_sync_at: nowIso,
    last_error: lastError ?? null,
    details,
  };

  if (status === 'success') {
    payload.last_success_at = nowIso;
  }

  const { error } = await supabase
    .from('bonus_source_statuses')
    .upsert(payload, { onConflict: 'source_code' });

  if (error) {
    console.error('Falha ao atualizar bonus_source_statuses:', error.message);
  }
}

async function relinkOrphanElapsedTimes(supabase: any) {
  const { data, error } = await supabase.rpc('relink_elapsed_times_to_tasks');
  if (error) {
    if (error.message?.includes('Could not find the function')) {
      console.warn('RPC relink_elapsed_times_to_tasks ainda não disponível no banco. Seguindo sem relink.');
      return 0;
    }
    throw new Error(`Erro ao relinkar elapsed_times órfãos: ${error.message}`);
  }

  return Number(data ?? 0);
}

async function persistBonusSnapshots(supabase: any, syncStartedAtIso: string) {
  const now = new Date();
  const nowIso = now.toISOString();
  const currentMonthKey = monthKey(now);
  const currentQuarterKey = quarterKey(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const quarterStart = startOfQuarter(now);
  const quarterEnd = endOfQuarter(now);

  const [
    usersRes,
    tasksRows,
    elapsedRows,
    projectsRows,
    clientesRows,
    financialRows,
    clientKpiRows,
    benchmarkRes,
    weightRes,
    capacityRows,
  ] = await Promise.all([
    supabase.from('users').select('id, name, department, seniority_level').eq('active', true),
    fetchAllRows(
      supabase,
      'tasks',
      'task_id,status,deadline,closed_date,project_id,responsible_id,responsible_name,updated_at',
      'task_id',
    ),
    fetchAllRows(
      supabase,
      'elapsed_times',
      'id,task_id,user_id,date_start,created_date,inserted_at,updated_at,seconds',
      'id',
    ),
    fetchAllRows(supabase, 'projects', 'id,name,cliente_id', 'id'),
    fetchAllRows(supabase, 'clientes', 'cliente_id,nome', 'cliente_id'),
    fetchAllRows(
      supabase,
      'project_financials',
      'project_id,receita_projeto,custo_hora,custo_total_estimado,observacoes',
      'project_id',
    ),
    fetchAllRows(
      supabase,
      'client_kpis',
      'id,cliente_id,cliente_name,month,ebitda,churn,nps,updated_at',
      'month',
      false,
    ),
    supabase.from('client_benchmarks').select('ebitda_avg, churn_avg, nps_avg').limit(1),
    supabase.from('health_score_config').select('weight_ebitda, weight_churn, weight_nps').limit(1),
    supabase.from('user_capacity').select('user_id, available_hours, month').eq('month', currentMonthKey),
  ]);

  if (usersRes.error) throw new Error(`Erro ao carregar users para bonus: ${usersRes.error.message}`);
  if (benchmarkRes.error) throw new Error(`Erro ao carregar client_benchmarks: ${benchmarkRes.error.message}`);
  if (weightRes.error) throw new Error(`Erro ao carregar health_score_config: ${weightRes.error.message}`);
  if (capacityRows.error) throw new Error(`Erro ao carregar user_capacity: ${capacityRows.error.message}`);

  const activeUsers = (usersRes.data ?? []) as Array<{
    id: string;
    name: string;
    department: string | null;
    seniority_level: string | null;
  }>;
  const usersById = new Map(activeUsers.map((user) => [String(user.id), user]));
  const usersByName = new Map(activeUsers.map((user) => [normalizeName(user.name), user]));
  const projectsById = new Map((projectsRows ?? []).map((row: any) => [Number(row.id), row]));
  const clientNameById = new Map((clientesRows ?? []).map((row: any) => [Number(row.cliente_id), String(row.nome ?? '').trim()]));
  const capacityByUserId = new Map(
    ((capacityRows.data ?? []) as any[]).map((row) => [String(row.user_id), toNumber(row.available_hours) ?? 0]),
  );
  const weightsRow = (weightRes.data ?? [])[0] as any;
  const benchmarkRow = (benchmarkRes.data ?? [])[0] as any;
  const weights = {
    ebitda: toNumber(weightsRow?.weight_ebitda) ?? 0.4,
    churn: toNumber(weightsRow?.weight_churn) ?? 0.3,
    nps: toNumber(weightsRow?.weight_nps) ?? 0.3,
  };
  const benchmarks = benchmarkRow
    ? {
        ebitda: toNumber(benchmarkRow.ebitda_avg) ?? 100000,
        churn: toNumber(benchmarkRow.churn_avg) ?? 5,
        nps: toNumber(benchmarkRow.nps_avg) ?? 50,
      }
    : null;

  const latestHealthByClientName = new Map<string, number>();
  const latestKpiByClient = new Map<string, any>();
  for (const row of clientKpiRows ?? []) {
    const key =
      row.cliente_id != null
        ? `id:${row.cliente_id}`
        : `name:${normalizeName(String(row.cliente_name ?? ''))}`;
    const existing = latestKpiByClient.get(key);
    if (!existing || String(row.month ?? '') > String(existing.month ?? '')) {
      latestKpiByClient.set(key, row);
    }
  }
  for (const row of latestKpiByClient.values()) {
    const score = calcHealthScore(
      toNumber(row.ebitda),
      toNumber(row.churn),
      toNumber(row.nps),
      benchmarks,
      weights,
    );
    if (score == null) continue;
    const key = normalizeName(String(row.cliente_name ?? ''));
    if (key) latestHealthByClientName.set(key, score);
  }

  const monthElapsedRows = (elapsedRows ?? []).filter((row: any) =>
    isWithinRange(getElapsedEffectiveDate(row), monthStart, monthEnd),
  );
  const quarterElapsedRows = (elapsedRows ?? []).filter((row: any) =>
    isWithinRange(getElapsedEffectiveDate(row), quarterStart, quarterEnd),
  );

  const monthTaskIds = new Set<string>();
  const monthHoursByTaskId = new Map<string, number>();
  const quarterHoursByProjectId = new Map<number, number>();
  const monthHoursByProjectId = new Map<number, number>();
  const tasksById = new Map<string, any>();

  for (const task of tasksRows ?? []) {
    const taskId = String(task.task_id ?? '').trim();
    if (!taskId) continue;
    tasksById.set(taskId, task);
  }

  for (const row of monthElapsedRows) {
    const taskId = String(row.task_id ?? '').trim();
    if (!taskId) continue;
    const seconds = toNumber(row.seconds) ?? 0;
    const hours = seconds > 0 ? seconds / 3600 : 0;
    monthTaskIds.add(taskId);
    monthHoursByTaskId.set(taskId, (monthHoursByTaskId.get(taskId) ?? 0) + hours);

    const task = tasksById.get(taskId);
    const projectId = Number(task?.project_id ?? 0);
    if (projectId > 0) {
      monthHoursByProjectId.set(projectId, (monthHoursByProjectId.get(projectId) ?? 0) + hours);
    }
  }

  for (const row of quarterElapsedRows) {
    const taskId = String(row.task_id ?? '').trim();
    const task = tasksById.get(taskId);
    const projectId = Number(task?.project_id ?? 0);
    const seconds = toNumber(row.seconds) ?? 0;
    const hours = seconds > 0 ? seconds / 3600 : 0;
    if (projectId > 0) {
      quarterHoursByProjectId.set(projectId, (quarterHoursByProjectId.get(projectId) ?? 0) + hours);
    }
  }

  const consultantAcc = new Map<string, {
    userId: string;
    userName: string;
    department: string | null;
    seniority: string | null;
    totalTasks: number;
    completedTasks: number;
    onTimeCompleted: number;
    tasksWithDeadlineDone: number;
    overdueTasks: number;
    hoursTracked: number;
    projectIds: Set<number>;
    clientNames: Set<string>;
  }>();

  for (const task of tasksRows ?? []) {
    const taskId = String(task.task_id ?? '').trim();
    if (!taskId) continue;

    const deadline = parseDateValue(task.deadline);
    const closedDate = parseDateValue(task.closed_date);
    const updatedAt = parseDateValue(task.updated_at);
    const isMonthTask =
      monthTaskIds.has(taskId) ||
      isWithinRange(deadline, monthStart, monthEnd) ||
      isWithinRange(closedDate, monthStart, monthEnd) ||
      isWithinRange(updatedAt, monthStart, monthEnd);

    if (!isMonthTask) continue;

    const responsibleId = nonEmptyString(task.responsible_id);
    const responsibleName = nonEmptyString(task.responsible_name);
    const matchedUser =
      (responsibleId ? usersById.get(responsibleId) : null) ??
      (responsibleName ? usersByName.get(normalizeName(responsibleName)) : null) ??
      null;

    if (!matchedUser) continue;

    const projectId = Number(task.project_id ?? 0) || 0;
    const project = projectId > 0 ? projectsById.get(projectId) : null;
    const clientName = nonEmptyString(clientNameById.get(Number(project?.cliente_id ?? 0)) ?? null);
    const status = toInt(task.status);
    const isDone = status === 5;
    const isOverdue = !isDone && deadline != null && deadline < now;

    const current = consultantAcc.get(String(matchedUser.id)) ?? {
      userId: String(matchedUser.id),
      userName: String(matchedUser.name ?? '').trim(),
      department: matchedUser.department ?? null,
      seniority: matchedUser.seniority_level ?? null,
      totalTasks: 0,
      completedTasks: 0,
      onTimeCompleted: 0,
      tasksWithDeadlineDone: 0,
      overdueTasks: 0,
      hoursTracked: 0,
      projectIds: new Set<number>(),
      clientNames: new Set<string>(),
    };

    current.totalTasks += 1;
    if (isDone) current.completedTasks += 1;
    if (isOverdue) current.overdueTasks += 1;
    if (isDone && deadline) {
      current.tasksWithDeadlineDone += 1;
      if (closedDate && closedDate <= deadline) current.onTimeCompleted += 1;
    }
    if (projectId > 0) current.projectIds.add(projectId);
    if (clientName) current.clientNames.add(clientName);
    current.hoursTracked += monthHoursByTaskId.get(taskId) ?? 0;

    consultantAcc.set(String(matchedUser.id), current);
  }

  const consultantSnapshotsPayload: any[] = [];
  const consultantBreakdownsByKey = new Map<string, any[]>();

  for (const acc of consultantAcc.values()) {
    const snapshotUserId = toNumber(acc.userId);
    if (snapshotUserId == null) continue;

    const linkedHealth = Array.from(acc.clientNames)
      .map((clientName) => latestHealthByClientName.get(normalizeName(clientName)))
      .filter((value): value is number => value != null);
    const healthScore = average(linkedHealth);
    const availableHours = capacityByUserId.get(acc.userId) ?? null;
    const utilization = availableHours && availableHours > 0
      ? Math.round(((acc.hoursTracked / availableHours) * 100) * 10) / 10
      : null;
    const onTimeRate = acc.tasksWithDeadlineDone > 0
      ? Math.round((acc.onTimeCompleted / acc.tasksWithDeadlineDone) * 100)
      : null;
    const overdueRate = acc.totalTasks > 0
      ? Math.round((acc.overdueTasks / acc.totalTasks) * 100)
      : null;
    const score = Math.round(
      consultantScoreFromMetrics({
        onTimeRate,
        overdueRate,
        utilization,
        healthScore,
      }) * 100,
    );
    const maxBonus = maxBonusForLevel(acc.seniority);
    const payout = Math.round((score / 100) * maxBonus);
    const snapshotKey = `consultant_monthly:${currentMonthKey}:consultant:${acc.userId}`;

    consultantSnapshotsPayload.push({
      snapshot_kind: 'consultant_monthly',
      period_type: 'month',
      period_key: currentMonthKey,
      subject_key: `consultant:${acc.userId}`,
      user_id: snapshotUserId,
      subject_role: normalizeLevel(acc.seniority),
      score,
      payout_amount: payout,
      max_payout_amount: maxBonus,
      sync_status: 'partial',
      source_provenance: 'mixed',
      source_updated_at: syncStartedAtIso,
      calculated_at: nowIso,
      calculation_version: BONUS_CALCULATION_VERSION,
      explanation: {
        consultant_name: acc.userName,
        supported_metrics: ['on_time_rate', 'utilization', 'health_score', 'tracked_hours'],
        unavailable_metrics: ['quality_score', 'is_rework', 'scope_compliance', 'soft_skill_score', 'people_skill_score'],
      },
      notes: 'Snapshot mensal persistido com dados reais disponíveis hoje; métricas subjetivas e de retrabalho/escopo permanecem indisponíveis.',
    });

    consultantBreakdownsByKey.set(snapshotKey, [
      {
        metric_code: 'on_time_rate',
        metric_label: 'Entrega no prazo',
        metric_group: 'operacional',
        metric_value: onTimeRate,
        metric_target: 95,
        metric_unit: '%',
        meets_target: onTimeRate != null ? onTimeRate >= 95 : null,
        source_provenance: 'bitrix',
        source_entity: 'tasks',
        source_record_key: `consultant:${acc.userId}`,
        source_updated_at: syncStartedAtIso,
        details: { availability_status: onTimeRate != null ? 'available' : 'unavailable', consultant_name: acc.userName },
      },
      {
        metric_code: 'utilization',
        metric_label: 'Utilização',
        metric_group: 'capacidade',
        metric_value: utilization,
        metric_target: 70,
        metric_unit: '%',
        meets_target: utilization != null ? utilization >= 70 : null,
        source_provenance: 'mixed',
        source_entity: 'user_capacity',
        source_record_key: acc.userId,
        source_updated_at: syncStartedAtIso,
        details: {
          availability_status: utilization != null ? 'available' : 'unavailable',
          unavailable_reason: utilization == null ? 'Sem capacidade mensal cadastrada para o consultor no período atual.' : null,
        },
      },
      {
        metric_code: 'health_score',
        metric_label: 'Saúde da carteira',
        metric_group: 'carteira',
        metric_value: healthScore != null ? Math.round(healthScore * 10) / 10 : null,
        metric_target: 70,
        metric_unit: 'pts',
        meets_target: healthScore != null ? healthScore >= 70 : null,
        source_provenance: 'mixed',
        source_entity: 'client_kpis',
        source_record_key: `consultant:${acc.userId}`,
        source_updated_at: syncStartedAtIso,
        details: {
          availability_status: healthScore != null ? 'available' : 'unavailable',
          unavailable_reason: healthScore == null ? 'Nenhum cliente com health score real vinculado à carteira do consultor neste recorte.' : null,
        },
      },
      {
        metric_code: 'tracked_hours',
        metric_label: 'Horas apontadas',
        metric_group: 'operacional',
        metric_value: Math.round(acc.hoursTracked * 10) / 10,
        metric_target: null,
        metric_unit: 'h',
        meets_target: null,
        source_provenance: 'bitrix',
        source_entity: 'elapsed_times',
        source_record_key: `consultant:${acc.userId}`,
        source_updated_at: syncStartedAtIso,
        details: { availability_status: 'available' },
      },
      {
        metric_code: 'quality_score',
        metric_label: 'Qualidade técnica',
        metric_group: 'qualitativo',
        metric_value: null,
        metric_target: null,
        metric_unit: 'pts',
        meets_target: null,
        source_provenance: 'calculated',
        source_entity: 'unsupported',
        source_record_key: 'quality_score',
        source_updated_at: syncStartedAtIso,
        details: { availability_status: 'unavailable', unavailable_reason: 'Ainda não existe fonte real com quality_score no upstream.' },
      },
      {
        metric_code: 'is_rework',
        metric_label: 'Taxa de retrabalho',
        metric_group: 'qualitativo',
        metric_value: null,
        metric_target: 5,
        metric_unit: '%',
        meets_target: null,
        source_provenance: 'calculated',
        source_entity: 'unsupported',
        source_record_key: 'is_rework',
        source_updated_at: syncStartedAtIso,
        details: { availability_status: 'unavailable', unavailable_reason: 'O upstream ainda não registra flag real de retrabalho por tarefa ou projeto.' },
      },
      {
        metric_code: 'scope_compliance',
        metric_label: 'Aderência ao escopo',
        metric_group: 'qualitativo',
        metric_value: null,
        metric_target: 95,
        metric_unit: '%',
        meets_target: null,
        source_provenance: 'calculated',
        source_entity: 'unsupported',
        source_record_key: 'scope_compliance',
        source_updated_at: syncStartedAtIso,
        details: { availability_status: 'unavailable', unavailable_reason: 'Ainda não existe campo real de scope_compliance na operação.' },
      },
      {
        metric_code: 'soft_skill_score',
        metric_label: 'Soft Skills',
        metric_group: 'avaliacao_interna',
        metric_value: null,
        metric_target: null,
        metric_unit: 'pts',
        meets_target: null,
        source_provenance: 'manual',
        source_entity: 'bonus_internal_evaluations',
        source_record_key: `consultant:${acc.userId}`,
        source_updated_at: syncStartedAtIso,
        details: { availability_status: 'unavailable', unavailable_reason: 'Ainda não existe avaliação interna real salva para soft skills.' },
      },
      {
        metric_code: 'people_skill_score',
        metric_label: 'People Skills',
        metric_group: 'avaliacao_interna',
        metric_value: null,
        metric_target: null,
        metric_unit: 'pts',
        meets_target: null,
        source_provenance: 'manual',
        source_entity: 'bonus_internal_evaluations',
        source_record_key: `consultant:${acc.userId}`,
        source_updated_at: syncStartedAtIso,
        details: { availability_status: 'unavailable', unavailable_reason: 'Ainda não existe avaliação interna real salva para people skills.' },
      },
    ]);
  }

  const buildRevenueSummary = (hoursByProject: Map<number, number>) => {
    let revenueTracked = 0;
    let estimatedCost = 0;
    const roiValues: number[] = [];

    for (const row of financialRows ?? []) {
      const projectId = Number(row.project_id ?? 0);
      if (!projectId) continue;
      const receita = toNumber(row.receita_projeto) ?? 0;
      const custoHora = toNumber(row.custo_hora) ?? 0;
      const custoTotalEstimado = toNumber(row.custo_total_estimado) ?? 0;
      const hoursUsed = hoursByProject.get(projectId) ?? 0;
      const estimatedProjectCost = custoHora > 0 ? custoHora * hoursUsed : custoTotalEstimado;

      revenueTracked += receita;
      estimatedCost += estimatedProjectCost;

      if (estimatedProjectCost > 0) {
        roiValues.push(((receita - estimatedProjectCost) / estimatedProjectCost) * 100);
      }
    }

    const estimatedMargin = revenueTracked > 0
      ? ((revenueTracked - estimatedCost) / revenueTracked) * 100
      : null;
    const healthyScores = Array.from(latestHealthByClientName.values());
    const healthyClients = healthyScores.filter((score) => score >= 70).length;
    const healthyClientsRatio = healthyScores.length > 0
      ? (healthyClients / healthyScores.length) * 100
      : null;
    const averageRoi = average(roiValues);
    const marginScore = estimatedMargin != null ? clamp(estimatedMargin / 30) : 0.5;
    const roiPositiveRatio = roiValues.length > 0 ? roiValues.filter((value) => value > 0).length / roiValues.length : 0.4;
    const healthScore = healthyClientsRatio != null ? clamp(healthyClientsRatio / 80) : 0.5;
    const revopsScore = (marginScore * 0.4) + (roiPositiveRatio * 0.35) + (healthScore * 0.25);

    return {
      revenueTracked: Math.round(revenueTracked),
      estimatedCost: Math.round(estimatedCost),
      estimatedMargin: estimatedMargin != null ? Math.round(estimatedMargin * 10) / 10 : null,
      averageRoi: averageRoi != null ? Math.round(averageRoi * 10) / 10 : null,
      healthyClientsRatio: healthyClientsRatio != null ? Math.round(healthyClientsRatio) : null,
      croMonthlyEstimate: Math.round(revopsScore * 1500),
      croQuarterlyEstimate:
        (healthyClientsRatio ?? 0) >= 80 && (estimatedMargin ?? 0) >= 30
          ? 1000
          : (healthyClientsRatio ?? 0) >= 70
          ? 500
          : 0,
      annualStrategicEstimate: revenueTracked >= 300000 && (estimatedMargin ?? 0) >= 30 ? 10000 : 0,
    };
  };

  const monthlyRevenue = buildRevenueSummary(monthHoursByProjectId);
  const quarterlyRevenue = buildRevenueSummary(quarterHoursByProjectId);

  const managementSnapshotsPayload = [
    {
      snapshot_kind: 'commercial_monthly',
      period_type: 'month',
      period_key: currentMonthKey,
      subject_key: 'cro:revops_monthly',
      user_id: null,
      subject_role: 'cro',
      score: Math.round(clamp(monthlyRevenue.croMonthlyEstimate / 1500) * 100),
      payout_amount: monthlyRevenue.croMonthlyEstimate,
      max_payout_amount: 1500,
      sync_status: 'partial',
      source_provenance: 'mixed',
      source_updated_at: syncStartedAtIso,
      calculated_at: nowIso,
      calculation_version: BONUS_CALCULATION_VERSION,
      explanation: {
        supported_metrics: ['estimated_margin', 'healthy_clients_ratio', 'average_roi'],
        unavailable_metrics: ['mql_sql_conversion', 'icp_adherence', 'meeting_attendance'],
      },
      notes: 'Snapshot comercial mensal persistido com proxy financeiro real; CRM comercial ainda não foi ingerido.',
    },
    {
      snapshot_kind: 'revenue_quarterly',
      period_type: 'quarter',
      period_key: currentQuarterKey,
      subject_key: 'cro:revenue_quarterly',
      user_id: null,
      subject_role: 'cro',
      score: Math.round(
        clamp(
          (((quarterlyRevenue.healthyClientsRatio ?? 0) / 80) * 0.5) +
          (((quarterlyRevenue.estimatedMargin ?? 0) / 30) * 0.5),
        ) * 100,
      ),
      payout_amount: quarterlyRevenue.croQuarterlyEstimate,
      max_payout_amount: 1000,
      sync_status: 'partial',
      source_provenance: 'mixed',
      source_updated_at: syncStartedAtIso,
      calculated_at: nowIso,
      calculation_version: BONUS_CALCULATION_VERSION,
      explanation: {
        supported_metrics: ['quarterly_bonus_estimate', 'estimated_margin', 'healthy_clients_ratio'],
        unavailable_metrics: ['nrr', 'mrr_history', 'recurring_contracts'],
      },
      notes: 'Snapshot trimestral persistido com proxy financeiro real; NRR e MRR continuam bloqueados sem histórico recorrente.',
    },
  ];

  const managementBreakdownsByKey = new Map<string, any[]>([
    [
      `commercial_monthly:${currentMonthKey}:cro:revops_monthly`,
      [
        {
          metric_code: 'estimated_margin',
          metric_label: 'Margem estimada',
          metric_group: 'financeiro',
          metric_value: monthlyRevenue.estimatedMargin,
          metric_target: 30,
          metric_unit: '%',
          meets_target: monthlyRevenue.estimatedMargin != null ? monthlyRevenue.estimatedMargin >= 30 : null,
          source_provenance: 'mixed',
          source_entity: 'project_financials',
          source_record_key: currentMonthKey,
          source_updated_at: syncStartedAtIso,
          details: { availability_status: monthlyRevenue.estimatedMargin != null ? 'available' : 'unavailable' },
        },
        {
          metric_code: 'healthy_clients_ratio',
          metric_label: 'Carteira saudável',
          metric_group: 'carteira',
          metric_value: monthlyRevenue.healthyClientsRatio,
          metric_target: 80,
          metric_unit: '%',
          meets_target: monthlyRevenue.healthyClientsRatio != null ? monthlyRevenue.healthyClientsRatio >= 80 : null,
          source_provenance: 'mixed',
          source_entity: 'client_kpis',
          source_record_key: currentMonthKey,
          source_updated_at: syncStartedAtIso,
          details: { availability_status: monthlyRevenue.healthyClientsRatio != null ? 'available' : 'unavailable' },
        },
        {
          metric_code: 'average_roi',
          metric_label: 'ROI médio',
          metric_group: 'financeiro',
          metric_value: monthlyRevenue.averageRoi,
          metric_target: null,
          metric_unit: '%',
          meets_target: null,
          source_provenance: 'mixed',
          source_entity: 'project_financials',
          source_record_key: currentMonthKey,
          source_updated_at: syncStartedAtIso,
          details: { availability_status: monthlyRevenue.averageRoi != null ? 'available' : 'unavailable' },
        },
        {
          metric_code: 'mql_sql_conversion',
          metric_label: 'Conversão MQL → SQL',
          metric_group: 'crm',
          metric_value: null,
          metric_target: 25,
          metric_unit: '%',
          meets_target: null,
          source_provenance: 'calculated',
          source_entity: 'unsupported',
          source_record_key: 'mql_sql_conversion',
          source_updated_at: syncStartedAtIso,
          details: { availability_status: 'unavailable', unavailable_reason: 'O CRM ainda não entrega MQL e SQL ingeridos no dashboard.' },
        },
        {
          metric_code: 'icp_adherence',
          metric_label: 'Aderência ao ICP',
          metric_group: 'crm',
          metric_value: null,
          metric_target: 80,
          metric_unit: '%',
          meets_target: null,
          source_provenance: 'calculated',
          source_entity: 'unsupported',
          source_record_key: 'icp_adherence',
          source_updated_at: syncStartedAtIso,
          details: { availability_status: 'unavailable', unavailable_reason: 'Ainda não existe score ICP ingerido do CRM.' },
        },
        {
          metric_code: 'meeting_attendance',
          metric_label: 'Comparecimento em reuniões',
          metric_group: 'crm',
          metric_value: null,
          metric_target: 70,
          metric_unit: '%',
          meets_target: null,
          source_provenance: 'calculated',
          source_entity: 'unsupported',
          source_record_key: 'meeting_attendance',
          source_updated_at: syncStartedAtIso,
          details: { availability_status: 'unavailable', unavailable_reason: 'O CRM ainda não informa presença real em reuniões comerciais.' },
        },
      ],
    ],
    [
      `revenue_quarterly:${currentQuarterKey}:cro:revenue_quarterly`,
      [
        {
          metric_code: 'quarterly_bonus_estimate',
          metric_label: 'Bônus trimestral estimado',
          metric_group: 'financeiro',
          metric_value: quarterlyRevenue.croQuarterlyEstimate,
          metric_target: 1000,
          metric_unit: 'BRL',
          meets_target: quarterlyRevenue.croQuarterlyEstimate >= 1000,
          source_provenance: 'mixed',
          source_entity: 'project_financials',
          source_record_key: currentQuarterKey,
          source_updated_at: syncStartedAtIso,
          details: { availability_status: 'available' },
        },
        {
          metric_code: 'estimated_margin',
          metric_label: 'Margem estimada',
          metric_group: 'financeiro',
          metric_value: quarterlyRevenue.estimatedMargin,
          metric_target: 30,
          metric_unit: '%',
          meets_target: quarterlyRevenue.estimatedMargin != null ? quarterlyRevenue.estimatedMargin >= 30 : null,
          source_provenance: 'mixed',
          source_entity: 'project_financials',
          source_record_key: currentQuarterKey,
          source_updated_at: syncStartedAtIso,
          details: { availability_status: quarterlyRevenue.estimatedMargin != null ? 'available' : 'unavailable' },
        },
        {
          metric_code: 'healthy_clients_ratio',
          metric_label: 'Carteira saudável',
          metric_group: 'carteira',
          metric_value: quarterlyRevenue.healthyClientsRatio,
          metric_target: 80,
          metric_unit: '%',
          meets_target: quarterlyRevenue.healthyClientsRatio != null ? quarterlyRevenue.healthyClientsRatio >= 80 : null,
          source_provenance: 'mixed',
          source_entity: 'client_kpis',
          source_record_key: currentQuarterKey,
          source_updated_at: syncStartedAtIso,
          details: { availability_status: quarterlyRevenue.healthyClientsRatio != null ? 'available' : 'unavailable' },
        },
        {
          metric_code: 'nrr',
          metric_label: 'NRR',
          metric_group: 'recorrencia',
          metric_value: null,
          metric_target: 105,
          metric_unit: '%',
          meets_target: null,
          source_provenance: 'calculated',
          source_entity: 'unsupported',
          source_record_key: 'nrr',
          source_updated_at: syncStartedAtIso,
          details: { availability_status: 'unavailable', unavailable_reason: 'Ainda não existe histórico real de MRR por cliente para calcular NRR.' },
        },
        {
          metric_code: 'mrr_history',
          metric_label: 'Histórico de MRR',
          metric_group: 'recorrencia',
          metric_value: null,
          metric_target: null,
          metric_unit: 'BRL',
          meets_target: null,
          source_provenance: 'calculated',
          source_entity: 'unsupported',
          source_record_key: 'mrr_history',
          source_updated_at: syncStartedAtIso,
          details: { availability_status: 'unavailable', unavailable_reason: 'O upstream ainda não possui série histórica de receita recorrente.' },
        },
        {
          metric_code: 'recurring_contracts',
          metric_label: 'Contratos recorrentes',
          metric_group: 'recorrencia',
          metric_value: null,
          metric_target: null,
          metric_unit: 'count',
          meets_target: null,
          source_provenance: 'calculated',
          source_entity: 'unsupported',
          source_record_key: 'recurring_contracts',
          source_updated_at: syncStartedAtIso,
          details: { availability_status: 'unavailable', unavailable_reason: 'Ainda não existe base real de contratos recorrentes ligada ao dashboard.' },
        },
      ],
    ],
  ]);

  const snapshotPayloads = [...consultantSnapshotsPayload, ...managementSnapshotsPayload];
  if (!snapshotPayloads.length) {
    return {
      snapshot_rows_written: 0,
      breakdown_rows_written: 0,
      evaluation_rows_written: 0,
      evaluation_source: 'not_available',
      period_key_month: currentMonthKey,
      period_key_quarter: currentQuarterKey,
    };
  }

  const { data: snapshotRows, error: snapshotError } = await supabase
    .from('bonus_score_snapshots')
    .upsert(snapshotPayloads, {
      onConflict: 'snapshot_kind,period_key,subject_key',
    })
    .select('id,snapshot_kind,period_key,subject_key');

  if (snapshotError) {
    throw new Error(`Erro ao persistir bonus_score_snapshots: ${snapshotError.message}`);
  }

  const persistedSnapshotRows = snapshotRows ?? [];
  const snapshotIds = persistedSnapshotRows.map((row: any) => row.id);
  const breakdownPayloads: any[] = [];

  for (const row of persistedSnapshotRows) {
    const key = `${row.snapshot_kind}:${row.period_key}:${row.subject_key}`;
    const metrics = consultantBreakdownsByKey.get(key) ?? managementBreakdownsByKey.get(key) ?? [];
    metrics.forEach((metric) => {
      breakdownPayloads.push({
        snapshot_id: row.id,
        ...metric,
      });
    });
  }

  if (snapshotIds.length > 0) {
    const { error: deleteBreakdownsError } = await supabase
      .from('bonus_metric_breakdowns')
      .delete()
      .in('snapshot_id', snapshotIds);

    if (deleteBreakdownsError) {
      throw new Error(`Erro ao limpar bonus_metric_breakdowns antigos: ${deleteBreakdownsError.message}`);
    }
  }

  if (breakdownPayloads.length > 0) {
    const { error: breakdownError } = await supabase
      .from('bonus_metric_breakdowns')
      .insert(breakdownPayloads);

    if (breakdownError) {
      throw new Error(`Erro ao persistir bonus_metric_breakdowns: ${breakdownError.message}`);
    }
  }

  return {
    snapshot_rows_written: persistedSnapshotRows.length,
    breakdown_rows_written: breakdownPayloads.length,
    evaluation_rows_written: 0,
    evaluation_source: 'not_available',
    period_key_month: currentMonthKey,
    period_key_quarter: currentQuarterKey,
  };
}

function classifyWorkgroupType(rawProject: any, rawType: any, rawCollab?: any) {
  const isProject = rawProject === 'Y';
  if (isProject) return 'projeto';

  const collabValues = new Set(['y', 'yes', 'true', '1', 'collab']);
  const normalizedCollab = String(rawCollab ?? '').trim().toLowerCase();
  if (normalizedCollab && collabValues.has(normalizedCollab)) return 'collab';

  const normalizedType = String(rawType ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (normalizedType.includes('collab')) return 'collab';
  if (normalizedType.includes('grupo de trabalho')) return 'grupo de trabalho';
  if (normalizedType.includes('workgroup')) return 'grupo de trabalho';
  if (normalizedType.includes('group')) return 'grupo de trabalho';

  return 'grupo de trabalho';
}

Deno.serve(async (req) => {
  const startedAt = Date.now();
  let supabase: any = null;
  let runId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    supabase = createClient(supabaseUrl, supabaseKey);

    if (!BITRIX_BASE_URL) {
      throw new Error("A BITRIX_BASE_URL não foi configurada nos Secrets.");
    }

    console.log("--- INICIANDO SINCRONIZAÇÃO (V9 - ALL PROJECTS + ARCHIVED) ---");
    const syncStartedAtIso = new Date().toISOString();

    const runState = await createSyncRun(supabase, {
      started_at_iso: syncStartedAtIso,
      request_method: req.method,
    });

    if (runState?.skipped) {
      await logSkippedRun(
        supabase,
        { started_at_iso: syncStartedAtIso, request_method: req.method },
        runState.skipReason ?? 'Skipped due to overlap.',
      );
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: runState.skipReason ?? 'Skipped due to overlap.',
        }),
        { status: 202, headers: { "Content-Type": "application/json" } },
      );
    }

    runId = runState?.runId ?? null;
    await upsertSourceStatus(supabase, 'running', {
      started_at_iso: syncStartedAtIso,
      request_method: req.method,
    });

    // Cache para validar chaves estrangeiras
    const validProjectIds = new Set<number>();
    const workgroupTypeCounts = {
      projeto: 0,
      collab: 0,
      grupo_de_trabalho: 0,
    };
    const sampledNonProjectGroups: Array<Record<string, unknown>> = [];

    // =================================================================
    // ETAPA 1: PROJETOS (Ativos E Arquivados)
    // =================================================================
    console.log(">>> Etapa 1: Buscando Projetos (Ativos e Arquivados)...");
    
    // Vamos iterar por status para garantir que o Bitrix entregue tudo
    const projectStatuses = ['N', 'Y']; // N = Ativo, Y = Arquivado (Closed)
    let totalProjects = 0;

    const projectFields = [
      "ID", "ACTIVE", "NAME", "DESCRIPTION", "KEYWORDS", "CLOSED", 
      "VISIBLE", "OPENED", "DATE_CREATE", "DATE_UPDATE", "DATE_ACTIVITY", 
      "NUMBER_OF_MEMBERS", "PROJECT", "PROJECT_DATE_START", "PROJECT_DATE_FINISH",
      "TYPE", "SUBJECT_NAME", "COLLAB", "IS_COLLAB"
    ];

    for (const status of projectStatuses) {
      console.log(`>>> Buscando projetos com CLOSED = ${status}...`);
      let startProjects = 0;
      let hasMoreProjects = true;

      while (hasMoreProjects) {
        const projUrl = new URL('socialnetwork.api.workgroup.list', BITRIX_BASE_URL);
        projUrl.searchParams.append('start', startProjects.toString());
        
        // FILTRO EXPLÍCITO: Traz ou Ativos ou Arquivados
        projUrl.searchParams.append('filter[CLOSED]', status);
        
        // SELECT EXPLÍCITO: Garante que os campos venham preenchidos
        projectFields.forEach(f => projUrl.searchParams.append('select[]', f));
        
        const data = await fetchJsonWithRetry(projUrl.toString());
        const rawProjects = data.result?.workgroups || data.result || [];
        const projects = normalizeList(rawProjects);

        if (projects.length === 0) {
          hasMoreProjects = false;
          break;
        }

        const projectsToUpsert = projects
          .map((p: any) => {
            const rawId = getField(p, 'id', 'ID');
            if (!rawId) return null;

            const numericId = parseInt(rawId, 10);
            if (Number.isNaN(numericId)) return null;

            const rawName = getField(p, 'name', 'NAME');
            // Fallback de segurança para nome
            const safeName = (rawName && String(rawName).trim() !== '') 
              ? rawName 
              : `[SEM NOME] Projeto ID ${rawId}`;

            const rawActive = getField(p, 'active', 'ACTIVE');
            const rawDesc = getField(p, 'description', 'DESCRIPTION');
            const rawKeywords = getField(p, 'keywords', 'KEYWORDS');
            const rawClosed = getField(p, 'closed', 'CLOSED');
            const rawVisible = getField(p, 'visible', 'VISIBLE');
            const rawOpened = getField(p, 'opened', 'OPENED');
            const rawDateCreate = getField(p, 'dateCreate', 'DATE_CREATE');
            const rawDateUpdate = getField(p, 'dateUpdate', 'DATE_UPDATE');
            const rawDateActivity = getField(p, 'dateActivity', 'DATE_ACTIVITY');
            const rawMembers = getField(p, 'numberOfMembers', 'NUMBER_OF_MEMBERS');
            const rawProject = getField(p, 'project', 'PROJECT');
            const rawDateStart = getField(p, 'projectDateStart', 'PROJECT_DATE_START');
            const rawDateFinish = getField(p, 'projectDateFinish', 'PROJECT_DATE_FINISH');
            const rawType = getField(p, 'type', 'TYPE') || getField(p, 'subjectName', 'SUBJECT_NAME');
            const rawCollab = getField(p, 'collab', 'COLLAB') ?? getField(p, 'isCollab', 'IS_COLLAB');

            const toBool = (val: any) => val === 'Y';
            const parseDate = (d: any) => d ? new Date(d).toISOString() : null;
            const isBitrixProject = toBool(rawProject);
            validProjectIds.add(numericId);
            const canonicalType = classifyWorkgroupType(rawProject, rawType, rawCollab);
            if (canonicalType === 'projeto') workgroupTypeCounts.projeto += 1;
            else if (canonicalType === 'collab') workgroupTypeCounts.collab += 1;
            else workgroupTypeCounts.grupo_de_trabalho += 1;

            if (!isBitrixProject && sampledNonProjectGroups.length < 10) {
              sampledNonProjectGroups.push({
                id: numericId,
                name: safeName,
                project_flag: rawProject,
                raw_type: getField(p, 'type', 'TYPE'),
                raw_collab: rawCollab,
                subject_name: getField(p, 'subjectName', 'SUBJECT_NAME'),
                type_canonical: canonicalType,
                keys: Object.keys(p).sort(),
              });
            }

            return {
              id: numericId,
              active: toBool(rawActive),
              name: safeName,
              description: rawDesc || '',
              keywords: rawKeywords || null,
              closed: toBool(rawClosed),
              visible: toBool(rawVisible),
              opened: toBool(rawOpened),
              date_create: parseDate(rawDateCreate),
              date_update: parseDate(rawDateUpdate),
              date_activity: parseDate(rawDateActivity),
              number_of_members: rawMembers ? parseInt(rawMembers) : 1,
              project: toBool(rawProject),
              project_date_start: parseDate(rawDateStart),
              project_date_finish: parseDate(rawDateFinish),
              type: canonicalType,
            };
          })
          .filter((p: any) => p !== null);

        if (projectsToUpsert.length > 0) {
          const { error: projError } = await supabase
            .from('projects')
            .upsert(projectsToUpsert, { onConflict: 'id' });

          if (projError) {
              console.error(`Erro Upsert Projects (${status}):`, projError);
              throw new Error(`Erro Upsert Projects: ${projError.message}`);
          }
          totalProjects += projectsToUpsert.length;
        }

        if (data.next) {
          startProjects = data.next;
          await new Promise((r) => setTimeout(r, DELAY_MS));
        } else {
          hasMoreProjects = false;
        }
      }
    }
    console.log(`>>> Total de Projetos sincronizados (Ativos + Arquivados): ${totalProjects}`);
    console.log(`>>> Cache de IDs válidos: ${validProjectIds.size}`);

    const dbProjects = await fetchAllRows(supabase, 'projects', 'id,name,closed', 'id');
    const projectIdByNormalizedName = new Map<string, number>();

    for (const projectRow of dbProjects ?? []) {
      const projectId = toInt((projectRow as any)?.id);
      const projectName = nonEmptyString((projectRow as any)?.name);
      if (!projectId) continue;
      validProjectIds.add(projectId);
      if (projectName) {
        const normalizedProjectName = normalizeName(projectName);
        if (normalizedProjectName && !projectIdByNormalizedName.has(normalizedProjectName)) {
          projectIdByNormalizedName.set(normalizedProjectName, projectId);
        }
      }
    }


    // =================================================================
    // ETAPA 2: TAREFAS
    // =================================================================
    console.log(">>> Etapa 2: Buscando Tarefas...");
    const canonicalTasks = new Map<number, any>();
    const seenTaskIds = new Set<number>();
    const deadlineChanges: Array<{
      task_id: number;
      task_title: string | null;
      previous_deadline: string | null;
      new_deadline: string | null;
      changed_by: string;
      change_description: string;
      detected_at: string;
      sync_run_id: string | null;
    }> = [];
    const existingRows = await fetchTasksForReconciliation(supabase);
    const existingTasksMap = new Map(existingRows.map((row: any) => [Number(row.task_id), row]));
    const tombstones = await fetchDeleteTombstones(supabase);
    const incrementalSince = await getLastTaskSyncCursor(supabase);
    const incrementalPayload = await fetchIncrementalTaskPages(incrementalSince);
    const sourceTasks = incrementalPayload.mode === 'incremental' && incrementalPayload.pages.length > 0
      ? incrementalPayload.pages
      : [];

    console.log('>>> Estratégia de sync de tarefas:', {
      mode: incrementalPayload.mode,
      incremental_since: incrementalSince,
      fetched_tasks: sourceTasks.length,
    });

    const tasksToUpsert = sourceTasks
      .map((t: any) => {
        const rawId = getField(t, 'id', 'ID');
        if (!rawId) return null;
        const numericId = toInt(rawId);
        if (!numericId) return null;

        const rawTitle = getField(t, 'title', 'TITLE');
        const rawDesc = getField(t, 'description', 'DESCRIPTION');
        const rawStatus = getField(t, 'status', 'STATUS');
        const rawDeadline = getField(t, 'deadline', 'DEADLINE');
        const rawClosedDate = getField(t, 'closedDate', 'CLOSED_DATE');
        const rawChangedDate = getField(t, 'changedDate', 'CHANGED_DATE');
        const rawGroupId = getField(t, 'groupId', 'GROUP_ID');
        const rawRespId = getField(t, 'responsibleId', 'RESPONSIBLE_ID');

        const responsibleName = t.responsible?.name || t.RESPONSIBLE?.NAME || null;
        const groupName = t.group?.name || t.GROUP?.NAME || null;
        const normalizedGroupName = groupName ? normalizeName(String(groupName)) : '';

        const deadline = toIso(rawDeadline);
        const closedDate = toIso(rawClosedDate);
        const changedDate = toIso(rawChangedDate);
        const originalGroupId = toInt(rawGroupId);
        let projectId = null;
        if (originalGroupId && rawGroupId !== "0") {
          const possibleId = originalGroupId;
          if (possibleId && validProjectIds.has(possibleId)) {
            projectId = possibleId;
          } else if (normalizedGroupName) {
            projectId = projectIdByNormalizedName.get(normalizedGroupName) ?? null;
          }
        }

        const projectRow = projectId ? (dbProjects ?? []).find((row: any) => Number(row.id) === projectId) : null;
        const projectClosed = Boolean((projectRow as any)?.closed ?? false);

        seenTaskIds.add(numericId);
        return {
          task_id: numericId,
          title: nonEmptyString(rawTitle) || `Tarefa ${rawId}`,
          description: nonEmptyString(rawDesc) || '',
          status: toInt(rawStatus),
          real_status: toInt(rawStatus),
          deadline,
          closed_date: closedDate,
          changed_date: changedDate,
          group_id: originalGroupId,
          group_name: nonEmptyString(groupName),
          responsible_id: toInt(rawRespId),
          responsible_name: nonEmptyString(responsibleName),
          updated_at: new Date().toISOString(),
          project_id: projectId,
          project_closed: projectClosed,
          local_state: projectClosed ? 'project_archived' : 'active',
          last_seen_at: syncStartedAtIso,
          last_seen_in_bitrix_at: syncStartedAtIso,
          bitrix_visible: true,
          missing_from_bitrix_since: null,
        };
      })
      .filter((task: any) => task !== null)
      .map((task: any) => {
        const previous = existingTasksMap.get(task.task_id) ?? canonicalTasks.get(task.task_id);
        const merged = mergeTaskRecord(task, previous);
        canonicalTasks.set(task.task_id, merged);

        if (previous) {
          const oldDeadline = previous.deadline ?? null;
          const newDeadline = merged.deadline ?? null;
          if (oldDeadline !== newDeadline && (oldDeadline || newDeadline)) {
            const fmtDate = (iso: string | null) => {
              if (!iso) return 'sem prazo';
              const d = new Date(iso);
              return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
            };
            deadlineChanges.push({
              task_id: merged.task_id,
              task_title: merged.title ?? null,
              previous_deadline: oldDeadline,
              new_deadline: newDeadline,
              changed_by: 'sync-bitrix',
              change_description: `Prazo alterado de ${fmtDate(oldDeadline)} para ${fmtDate(newDeadline)}`,
              detected_at: syncStartedAtIso,
              sync_run_id: runId,
            });
          }
        }

        return merged;
      });

    if (tasksToUpsert.length > 0) {
      const { error: taskError } = await supabase
        .from('tasks')
        .upsert(tasksToUpsert, { onConflict: 'task_id' });

      if (taskError) {
        throw new Error(`Erro ao salvar snapshot incremental de tarefas: ${taskError.message}`);
      }
    }

    const reconcileCandidates = existingRows.filter((row: any) => {
      const taskId = Number(row.task_id);
      if (!taskId || seenTaskIds.has(taskId)) return false;
      if (tombstones.has(taskId)) return true;

      const lastSeen = parseDateValue(row.last_seen_at ?? row.last_seen_in_bitrix_at);
      const tooOld = !lastSeen || (Date.now() - lastSeen.getTime()) >= TASK_STALE_AFTER_MS;
      const alreadyNeedsCheck = ['not_found_or_no_access', 'stale_not_seen'].includes(String(row.local_state ?? ''));
      return tooOld || alreadyNeedsCheck;
    });

    const reconciledUpdates: any[] = [];
    for (const row of reconcileCandidates) {
      const taskId = Number(row.task_id);
      if (!taskId) continue;

      if (tombstones.has(taskId)) {
        reconciledUpdates.push({
          task_id: taskId,
          bitrix_visible: false,
          local_state: 'deleted_confirmed',
          updated_at: new Date().toISOString(),
          missing_from_bitrix_since: toIso((tombstones.get(taskId) as any)?.deleted_at) ?? syncStartedAtIso,
        });
        continue;
      }

      const liveTask = await fetchBitrixTaskById(taskId);
      if (!liveTask) {
        reconciledUpdates.push({
          task_id: taskId,
          bitrix_visible: false,
          local_state: 'not_found_or_no_access',
          updated_at: new Date().toISOString(),
          missing_from_bitrix_since: row.missing_from_bitrix_since ?? syncStartedAtIso,
        });
        continue;
      }

      const liveGroupId = toInt(getField(liveTask, 'groupId', 'GROUP_ID'));
      const liveGroupName = liveTask.group?.name || liveTask.GROUP?.NAME || null;
      const normalizedGroupName = liveGroupName ? normalizeName(String(liveGroupName)) : '';
      let liveProjectId = null;
      if (liveGroupId) {
        if (validProjectIds.has(liveGroupId)) liveProjectId = liveGroupId;
        else if (normalizedGroupName) liveProjectId = projectIdByNormalizedName.get(normalizedGroupName) ?? null;
      }
      const projectRow = liveProjectId ? (dbProjects ?? []).find((item: any) => Number(item.id) === liveProjectId) : null;
      const projectClosed = Boolean((projectRow as any)?.closed ?? false);

      reconciledUpdates.push({
        task_id: taskId,
        title: nonEmptyString(getField(liveTask, 'title', 'TITLE')) ?? row.title ?? `Tarefa ${taskId}`,
        description: nonEmptyString(getField(liveTask, 'description', 'DESCRIPTION')) ?? row.description ?? '',
        status: toInt(getField(liveTask, 'status', 'STATUS')),
        real_status: toInt(getField(liveTask, 'status', 'STATUS')),
        deadline: toIso(getField(liveTask, 'deadline', 'DEADLINE')),
        closed_date: toIso(getField(liveTask, 'closedDate', 'CLOSED_DATE')),
        changed_date: toIso(getField(liveTask, 'changedDate', 'CHANGED_DATE')),
        group_id: liveGroupId,
        group_name: nonEmptyString(liveGroupName),
        responsible_id: toInt(getField(liveTask, 'responsibleId', 'RESPONSIBLE_ID')),
        responsible_name: nonEmptyString(liveTask.responsible?.name || liveTask.RESPONSIBLE?.NAME),
        updated_at: new Date().toISOString(),
        project_id: liveProjectId,
        project_closed: projectClosed,
        local_state: projectClosed ? 'project_archived' : 'active',
        last_seen_at: syncStartedAtIso,
        last_seen_in_bitrix_at: syncStartedAtIso,
        bitrix_visible: true,
        missing_from_bitrix_since: null,
      });
    }

    const staleUpdates = existingRows
      .filter((row: any) => {
        const taskId = Number(row.task_id);
        if (!taskId || seenTaskIds.has(taskId) || tombstones.has(taskId)) return false;
        const lastSeen = parseDateValue(row.last_seen_at ?? row.last_seen_in_bitrix_at);
        return Boolean(lastSeen && (Date.now() - lastSeen.getTime()) >= TASK_STALE_AFTER_MS && String(row.local_state ?? '') === 'active');
      })
      .map((row: any) => ({
        task_id: Number(row.task_id),
        local_state: 'stale_not_seen',
        bitrix_visible: true,
        updated_at: new Date().toISOString(),
        missing_from_bitrix_since: row.missing_from_bitrix_since ?? syncStartedAtIso,
      }));

    const allStateUpdates = [...reconciledUpdates, ...staleUpdates];
    if (allStateUpdates.length > 0) {
      const { error: reconcileError } = await supabase
        .from('tasks')
        .upsert(allStateUpdates, { onConflict: 'task_id' });
      if (reconcileError) {
        throw new Error(`Erro ao reconciliar estados locais das tarefas: ${reconcileError.message}`);
      }
    }

    // Persist deadline changes (deduplicated via unique index)
    let deadlineChangesWritten = 0;
    if (deadlineChanges.length > 0) {
      for (const change of deadlineChanges) {
        const { error: dcError } = await supabase
          .from('task_deadline_changes')
          .insert(change);
        if (dcError) {
          // Unique constraint violation = duplicate, skip silently
          if (dcError.code !== '23505') {
            console.error(`Erro ao registrar alteração de prazo task ${change.task_id}: ${dcError.message}`);
          }
        } else {
          deadlineChangesWritten += 1;
        }
      }
      console.log(`>>> ${deadlineChangesWritten} alterações de prazo registradas.`);
    }

    const relinkedOrphans = await relinkOrphanElapsedTimes(supabase);
    const bonusPersistence = await persistBonusSnapshots(supabase, syncStartedAtIso);

    const responseBody = {
      success: true,
      projects: totalProjects,
      project_type_counts: workgroupTypeCounts,
      sampled_non_project_groups: sampledNonProjectGroups,
      tasks: canonicalTasks.size,
      deadline_changes_detected: deadlineChangesWritten,
      incremental_mode: incrementalPayload.mode,
      incremental_since: incrementalSince,
      reconciled_tasks: reconciledUpdates.length,
      stale_tasks_marked: staleUpdates.length,
      deleted_tombstones_loaded: tombstones.size,
      relinked_orphan_rows: relinkedOrphans,
      bonus_persistence: bonusPersistence,
      duration_seconds: ((Date.now() - startedAt) / 1000).toFixed(1),
    };

    await finishSyncRun(supabase, runId, 'success', startedAt, responseBody, null, canonicalTasks.size);
    await upsertSourceStatus(supabase, 'success', {
      ...responseBody,
      last_incremental_changed_date: syncStartedAtIso,
      last_successful_sync_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify(responseBody),
      { headers: { "Content-Type": "application/json" } },
    );

  } catch (error) {
    console.error("ERRO FATAL:", error);
    const message = error instanceof Error ? error.message : String(error);
    const responseBody = {
      success: false,
      error: message,
      request_method: req.method,
      duration_seconds: ((Date.now() - startedAt) / 1000).toFixed(1),
    };
    if (supabase) {
      await finishSyncRun(
        supabase,
        runId,
        'error',
        startedAt,
        responseBody,
        message,
        0,
      );
      await upsertSourceStatus(supabase, 'error', responseBody, message);
    }
    return new Response(
      JSON.stringify(responseBody),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
