import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BITRIX_BASE_URL = Deno.env.get('BITRIX_ADMIN_BASE_URL') ?? Deno.env.get('BITRIX_BASE_URL');

const PAGE_SIZE = 50;
const UPSERT_BATCH_SIZE = 500;
const DB_TASK_PAGE_SIZE = 1000;
const RETRIES = 4;
const DELAY_MS = 200;
const DELAY_429_MS = 2500;
const SYNC_JOB_NAME = 'sync-bitrix-times';
const SOURCE_CODE = 'bitrix_elapsed_times';
const SOURCE_NAME = 'Bitrix Elapsed Times';
const SOURCE_ENTITY = 'elapsed_times';
const RUN_STALE_AFTER_MS = 3 * 60 * 60 * 1000;

function normalizeList(data: unknown): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'object') return Object.values(data as Record<string, unknown>);
  return [];
}

function getField(item: Record<string, any>, ...keys: string[]) {
  for (const key of keys) {
    if (item[key] !== undefined && item[key] !== null) return item[key];
  }
  return null;
}

function toInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  try {
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function bitrixPost(url: string, body: unknown): Promise<any> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.status === 429) {
        await sleep(DELAY_429_MS * (attempt + 1));
        continue;
      }

      if (response.status >= 500) {
        lastError = new Error(`HTTP ${response.status}`);
        await sleep(1000 * Math.pow(2, attempt));
        continue;
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      const data = await response.json();
      if (data.error && !data.result) {
        const message = String(data.error_description || data.error);
        if (message.includes('QUERY_LIMIT')) {
          await sleep(DELAY_429_MS * (attempt + 1));
          continue;
        }
        throw new Error(message);
      }

      return data;
    } catch (error: any) {
      if (error?.name === 'AbortError' || error?.message?.includes('fetch')) {
        lastError = error;
        await sleep(1000 * Math.pow(2, attempt));
        continue;
      }
      throw error;
    }
  }

  throw lastError ?? new Error('Bitrix request failed after retries');
}

async function fetchAllElapsedTimes(startAfterId = 0): Promise<any[]> {
  if (!BITRIX_BASE_URL) {
    throw new Error('A BITRIX_BASE_URL não foi configurada nos Secrets.');
  }

  const endpoint = new URL('task.elapseditem.getlist.json', BITRIX_BASE_URL).toString();
  const allItems: any[] = [];
  let lastId = startAfterId;

  console.log(`>>> Buscando elapsed items via cursor global (>ID), iniciando em ${startAfterId}...`);

  while (true) {
    const requestBody = {
      ORDER: { ID: 'ASC' },
      FILTER: { '>ID': lastId },
      SELECT: [
        'ID',
        'TASK_ID',
        'USER_ID',
        'MINUTES',
        'SECONDS',
        'CREATED_DATE',
        'DATE_START',
        'DATE_STOP',
        'SOURCE',
        'COMMENT_TEXT',
      ],
      PARAMS: {
        NAV_PARAMS: {
          nPageSize: PAGE_SIZE,
          iNumPage: 1,
        },
      },
    };

    const data = await bitrixPost(endpoint, requestBody);
    const items = normalizeList(data.result);

    if (items.length === 0) {
      console.log(`>>> Cursor finalizado em ID ${lastId}.`);
      break;
    }

    const lastItem = items[items.length - 1];
    const nextCursor = toInt(getField(lastItem, 'id', 'ID'));

    if (!nextCursor || nextCursor <= lastId) {
      throw new Error(`Cursor inválido retornado pelo Bitrix. lastId=${lastId}, nextCursor=${nextCursor}`);
    }

    allItems.push(...items);
    lastId = nextCursor;

    console.log(`>>> Lote global > ${lastId - items.length} | recebidos=${items.length} | cursor=${lastId} | total=${allItems.length}`);

    await sleep(DELAY_MS);
  }

  return allItems;
}

function parseElapsed(
  raw: Record<string, any>,
  taskStateById: Map<number, { local_state: string; project_closed: boolean }>,
  tombstones: Set<number>,
  detectedAt: string,
) {
  const id = toInt(getField(raw, 'id', 'ID'));
  if (!id) return null;

  const rawTaskId = toInt(getField(raw, 'taskId', 'TASK_ID', 'task_id'));
  const taskSnapshot = rawTaskId ? taskStateById.get(rawTaskId) ?? null : null;
  const hasLinkedTask = !!taskSnapshot;
  const deletedConfirmed = !!(rawTaskId && tombstones.has(rawTaskId));
  const seconds = toInt(getField(raw, 'seconds', 'SECONDS')) ?? 0;
  const minutes = toInt(getField(raw, 'minutes', 'MINUTES')) ?? 0;
  const dateStart = toIso(getField(raw, 'dateStart', 'DATE_START', 'date_start'));
  const dateStop = toIso(getField(raw, 'dateStop', 'DATE_STOP', 'date_stop'));
  const createdDate = toIso(getField(raw, 'createdDate', 'CREATED_DATE', 'created_date'));
  const isManualBackdated = !!(dateStart && dateStop && dateStart === dateStop && seconds > 0);

  let localState = 'active';
  let orphanReason: string | null = null;
  let orphanDetail: string | null = null;
  let taskId: number | null = hasLinkedTask ? rawTaskId : null;

  if (deletedConfirmed) {
    localState = 'deleted_confirmed';
    orphanReason = 'deleted_confirmed';
    orphanDetail = 'A hora pertence a uma tarefa excluida com confirmacao oficial via OnTaskDelete.';
    taskId = null;
  } else if (!taskSnapshot && rawTaskId) {
    localState = 'not_found_or_no_access';
    orphanReason = 'not_found_or_no_access';
    orphanDetail = 'A tarefa da hora nao foi localizada na base local e nao possui exclusao confirmada. O caso pode ser falta de acesso ou filtro.';
  } else if (taskSnapshot?.local_state === 'project_archived') {
    localState = 'project_archived';
    orphanReason = 'project_archived';
    orphanDetail = 'A hora esta ligada a uma tarefa de projeto ou grupo arquivado.';
  } else if (taskSnapshot?.local_state === 'deleted_confirmed') {
    localState = 'deleted_confirmed';
    orphanReason = 'deleted_confirmed';
    orphanDetail = 'A hora esta ligada a uma tarefa excluida com confirmacao oficial.';
    taskId = null;
  } else if (!rawTaskId) {
    localState = 'orphan_time_entry';
    orphanReason = 'missing_task_reference';
    orphanDetail = 'O lancamento chegou sem TASK_ID informado pelo Bitrix.';
  } else if (!hasLinkedTask) {
    localState = 'orphan_time_entry';
    orphanReason = 'missing_task_in_local_snapshot';
    orphanDetail = 'O lancamento chegou com TASK_ID, mas a tarefa ainda nao foi consolidada localmente.';
  }

  return {
    id,
    bitrix_task_id_raw: rawTaskId,
    task_id: taskId,
    orphan_reason: orphanReason,
    orphan_detail: orphanDetail,
    orphan_detected_at: orphanReason ? detectedAt : null,
    user_id: toInt(getField(raw, 'userId', 'USER_ID', 'user_id')),
    comment_text: String(getField(raw, 'commentText', 'COMMENT_TEXT', 'comment_text') ?? ''),
    date_start: dateStart,
    date_stop: dateStop,
    created_date: createdDate,
    minutes,
    seconds,
    source: (() => {
      const value = getField(raw, 'source', 'SOURCE');
      return value !== null && value !== undefined ? String(value) : null;
    })(),
    local_state: localState,
    is_manual_backdated: isManualBackdated,
    reference_date: createdDate ?? dateStart ?? dateStop ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function upsertElapsedTimes(supabase: any, records: any[]) {
  let inserted = 0;
  const errors: string[] = [];

  for (let offset = 0; offset < records.length; offset += UPSERT_BATCH_SIZE) {
    const batch = records.slice(offset, offset + UPSERT_BATCH_SIZE);
    const { error } = await supabase
      .from('elapsed_times')
      .upsert(batch, { onConflict: 'id' });

    if (!error) {
      inserted += batch.length;
      continue;
    }

    errors.push(`Batch ${offset}: ${error.message}`);

    for (const record of batch) {
      const { error: singleError } = await supabase
        .from('elapsed_times')
        .upsert(record, { onConflict: 'id' });

      if (!singleError) {
        inserted += 1;
      } else {
        errors.push(`ID ${record.id}: ${singleError.message}`);
      }
    }
  }

  return { inserted, errors };
}

async function fetchAllDbTasks(supabase: any): Promise<Map<number, { local_state: string; project_closed: boolean }>> {
  const tasks = new Map<number, { local_state: string; project_closed: boolean }>();
  let from = 0;

  while (true) {
    const to = from + DB_TASK_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('tasks')
      .select('task_id,local_state,project_closed')
      .range(from, to);

    if (error) {
      throw new Error(`Erro ao carregar tasks do banco: ${error.message}`);
    }

    const rows = (data ?? []) as Array<{ task_id?: number | string | null; local_state?: string | null; project_closed?: boolean | null }>;
    for (const row of rows) {
      const taskId = toInt(row.task_id);
      if (taskId) {
        tasks.set(taskId, {
          local_state: String(row.local_state ?? 'active'),
          project_closed: Boolean(row.project_closed ?? false),
        });
      }
    }

    if (rows.length < DB_TASK_PAGE_SIZE) {
      break;
    }

    from += DB_TASK_PAGE_SIZE;
  }

  return tasks;
}

async function fetchDeleteTombstones(supabase: any): Promise<Set<number>> {
  const ids = new Set<number>();
  let from = 0;

  while (true) {
    const to = from + DB_TASK_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('bitrix_task_delete_events')
      .select('task_id')
      .range(from, to);

    if (error) {
      throw new Error(`Erro ao carregar tombstones de tarefas: ${error.message}`);
    }

    const rows = (data ?? []) as Array<{ task_id?: number | string | null }>;
    for (const row of rows) {
      const taskId = toInt(row.task_id);
      if (taskId) ids.add(taskId);
    }

    if (rows.length < DB_TASK_PAGE_SIZE) break;
    from += DB_TASK_PAGE_SIZE;
  }

  return ids;
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

async function getLastSuccessfulCursorId(supabase: any): Promise<number> {
  const { data, error } = await supabase
    .from('bonus_source_statuses')
    .select('details, last_success_at')
    .eq('source_code', SOURCE_CODE)
    .maybeSingle();

  if (error) {
    console.error('Falha ao ler cursor salvo:', error.message);
    return 0;
  }

  const cursor = Number(data?.details?.last_cursor_id ?? 0);
  return Number.isFinite(cursor) && cursor > 0 ? cursor : 0;
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

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const startedAt = Date.now();
  const syncStartedAtIso = new Date().toISOString();
  let supabase: any = null;
  let runId: string | null = null;
  let debugTaskId: number | null = null;

  try {
    if (req.method !== 'GET') {
      try {
        const body = await req.json();
        debugTaskId = toInt(body?.debug_task_id);
      } catch {
        debugTaskId = null;
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    supabase = createClient(supabaseUrl, supabaseKey);

    if (!BITRIX_BASE_URL) {
      throw new Error('A BITRIX_BASE_URL não foi configurada nos Secrets.');
    }

    const runState = await createSyncRun(supabase, {
      strategy: 'global-cursor-by-id',
      started_at_iso: syncStartedAtIso,
    });

    if (runState?.skipped) {
      await logSkippedRun(
        supabase,
        { strategy: 'global-cursor-by-id', started_at_iso: syncStartedAtIso },
        runState.skipReason ?? 'Skipped due to overlap.',
      );
      return json({
        success: true,
        skipped: true,
        reason: runState.skipReason ?? 'Skipped due to overlap.',
      }, 202);
    }

    runId = runState?.runId ?? null;
    const lastCursorId = await getLastSuccessfulCursorId(supabase);
    await upsertSourceStatus(supabase, 'running', {
      strategy: 'global-cursor-by-id',
      started_at_iso: syncStartedAtIso,
      start_after_id: lastCursorId,
    });

    console.log('--- INICIANDO SINCRONIZAÇÃO GLOBAL DE ELAPSED TIMES ---');

    console.log('>>> Carregando snapshot local de tarefas e tombstones...');
    const taskStateById = await fetchAllDbTasks(supabase);
    const tombstones = await fetchDeleteTombstones(supabase);

    console.log(`>>> Tarefas no banco: ${taskStateById.size}`);
    console.log(`>>> Tombstones de exclusao confirmada: ${tombstones.size}`);

    const rawElapsed = await fetchAllElapsedTimes(lastCursorId);

    const byId = new Map<number, Record<string, any>>();
    for (const item of rawElapsed) {
      const id = toInt(getField(item, 'id', 'ID'));
      if (id) byId.set(id, item);
    }

    const records = Array.from(byId.values())
      .map((item) => parseElapsed(item, taskStateById, tombstones, syncStartedAtIso))
      .filter((item) => item !== null) as NonNullable<ReturnType<typeof parseElapsed>>[];

    const distinctTaskIds = new Set<number>();
    for (const item of rawElapsed) {
      const taskId = toInt(getField(item, 'taskId', 'TASK_ID', 'task_id'));
      if (taskId) distinctTaskIds.add(taskId);
    }

    console.log(`>>> Registros brutos recebidos: ${rawElapsed.length}`);
    console.log(`>>> Registros únicos por ID: ${records.length}`);
    console.log(`>>> Tarefas distintas encontradas nos tempos: ${distinctTaskIds.size}`);

    const { inserted, errors } = await upsertElapsedTimes(supabase, records);
    const relinkedCount = await relinkOrphanElapsedTimes(supabase);
    const orphanRowsDetected = records.filter((record) => record.orphan_reason !== null).length;
    const deletedHoursDetected = records.filter((record) => record.local_state === 'deleted_confirmed').length;
    const projectArchivedHoursDetected = records.filter((record) => record.local_state === 'project_archived').length;
    const noAccessHoursDetected = records.filter((record) => record.local_state === 'not_found_or_no_access').length;
    const manualBackdatedRows = records.filter((record) => record.is_manual_backdated).length;
    const debugMatches = debugTaskId
      ? rawElapsed.filter((item) => toInt(getField(item, 'taskId', 'TASK_ID', 'task_id')) === debugTaskId)
      : [];
    const debugMinutes = debugMatches.reduce((sum, item) => {
      const minutes = toInt(getField(item, 'minutes', 'MINUTES')) ?? 0;
      const seconds = toInt(getField(item, 'seconds', 'SECONDS')) ?? 0;
      return sum + minutes + (seconds / 60);
    }, 0);
    const durationSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    const maxCursorId = records.reduce((max, item) => Math.max(max, item.id), lastCursorId);

    const responseBody = {
      success: true,
      strategy: 'global-cursor-by-id',
      start_after_id: lastCursorId,
      max_cursor_id: maxCursorId,
      elapsed_raw_count: rawElapsed.length,
      elapsed_unique_count: records.length,
      elapsed_upserted: inserted,
      distinct_task_ids_found: distinctTaskIds.size,
      db_task_whitelist_count: taskStateById.size,
      deleted_task_tombstones_count: tombstones.size,
      orphan_rows_detected: orphanRowsDetected,
      deleted_task_hours_detected: deletedHoursDetected,
      project_archived_hours_detected: projectArchivedHoursDetected,
      not_found_or_no_access_hours_detected: noAccessHoursDetected,
      manual_backdated_rows: manualBackdatedRows,
      relinked_orphan_rows: relinkedCount,
      debug_task_id: debugTaskId,
      debug_task_exists_in_tasks_table: debugTaskId ? taskStateById.has(debugTaskId) : null,
      debug_task_raw_matches: debugMatches.length,
      debug_task_total_minutes: debugTaskId ? Number(debugMinutes.toFixed(2)) : null,
      errors_count: errors.length,
      errors_sample: errors.slice(0, 10),
      duration_seconds: durationSeconds,
    };

    await finishSyncRun(supabase, runId, 'success', startedAt, responseBody, null, inserted);
    await upsertSourceStatus(supabase, 'success', {
      ...responseBody,
      last_cursor_id: maxCursorId,
      last_successful_sync_at: new Date().toISOString(),
    });

    return json(responseBody);
  } catch (error: any) {
    console.error('ERRO FATAL:', error);
    const responseBody = {
      success: false,
      error: error.message || String(error),
      strategy: 'global-cursor-by-id',
      duration_seconds: ((Date.now() - startedAt) / 1000).toFixed(1),
    };
    if (supabase) {
      await finishSyncRun(
        supabase,
        runId,
        'error',
        startedAt,
        responseBody,
        error.message || String(error),
        0,
      );
      await upsertSourceStatus(supabase, 'error', responseBody, error.message || String(error));
    }
    return json(
      responseBody,
      500,
    );
  }
});
