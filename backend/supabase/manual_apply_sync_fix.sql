-- DashBoard-ISP | Aplicacao manual da correcao de sync/analytics
-- Projeto alvo: stubkeeuttixteqckshd
--
-- IMPORTANTE:
-- 1. Este SQL nao publica Edge Functions. Publique antes as functions alteradas:
--    - Get-Projetcs-And-Tasks-Bitrix
--    - sync-bitrix-times
--    - admin-diagnostics
-- 2. Substitua <SERVICE_ROLE_KEY_DO_PROJETO_STUB> pela service_role key do projeto correto.
-- 3. Rode os blocos na ordem. Nao rode o BLOCO 4 antes do BLOCO 3 indicar sucesso em bitrix_tasks.

-- BLOCO 0: preparar schema para o novo filtro "Data de criacao".
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS created_date timestamptz;

CREATE INDEX IF NOT EXISTS idx_tasks_created_date
  ON public.tasks (created_date DESC);

-- BLOCO 1: limpar execucoes travadas e estado "running" antigo.
UPDATE public.sync_job_runs
SET
  status = 'error',
  finished_at = now(),
  error_message = 'Marked stale manually before full resync.'
WHERE status = 'running'
  AND job_name IN ('Get-Projetcs-And-Tasks-Bitrix', 'sync-bitrix-times')
  AND started_at < now() - interval '35 minutes';

UPDATE public.bonus_source_statuses
SET
  sync_status = 'error',
  last_error = 'Marked stale manually before full resync.',
  last_sync_at = now(),
  details = coalesce(details, '{}'::jsonb) || jsonb_build_object(
    'manual_stale_cleanup_at', now()
  )
WHERE source_code IN ('bitrix_tasks', 'bitrix_elapsed_times')
  AND sync_status = 'running'
  AND last_sync_at < now() - interval '35 minutes';


-- BLOCO 2: recriar/agendar os crons reais em 4h no pg_cron e alinhar sync_job_configs.
-- Isso usa a RPC ja existente no projeto.
SELECT *
FROM public.schedule_bitrix_sync_jobs(
  'https://stubkeeuttixteqckshd.supabase.co',
  '<SERVICE_ROLE_KEY_DO_PROJETO_STUB>',
  '20 */4 * * *',
  '0 */4 * * *'
);

UPDATE public.sync_job_configs
SET cron_expression = '0 */4 * * *', updated_at = now()
WHERE job_name = 'Get-Projetcs-And-Tasks-Bitrix';

UPDATE public.sync_job_configs
SET cron_expression = '20 */4 * * *', updated_at = now()
WHERE job_name = 'sync-bitrix-times';


-- BLOCO 3: disparar sync completo de projetos/tarefas.
-- Depois de rodar este bloco, aguarde alguns minutos e consulte o BLOCO 3.1.
SELECT net.http_post(
  url := 'https://stubkeeuttixteqckshd.supabase.co/functions/v1/Get-Projetcs-And-Tasks-Bitrix',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'apikey', '<SERVICE_ROLE_KEY_DO_PROJETO_STUB>',
    'Authorization', 'Bearer <SERVICE_ROLE_KEY_DO_PROJETO_STUB>'
  ),
  body := '{"full_sync": true, "skip_bonus_persistence": true}'::jsonb
) AS request_id;

-- Se houver uma execucao comprovadamente morta por WORKER_RESOURCE_LIMIT, use este corpo
-- apenas uma vez no lugar do BLOCO 3:
-- body := '{"full_sync": true, "skip_bonus_persistence": true, "force_restart_running": true}'::jsonb

-- BLOCO 3.1: conferir se tarefas/projetos terminaram com sucesso.
-- Continue aguardando enquanto sync_status = 'running'.
SELECT
  source_code,
  sync_status,
  last_sync_at,
  last_success_at,
  last_error,
  details
FROM public.bonus_source_statuses
WHERE source_code = 'bitrix_tasks';

SELECT
  job_name,
  status,
  started_at,
  finished_at,
  duration_ms,
  records_processed,
  error_message,
  details
FROM public.sync_job_runs
WHERE job_name = 'Get-Projetcs-And-Tasks-Bitrix'
ORDER BY started_at DESC
LIMIT 5;


-- BLOCO 4: somente depois de bitrix_tasks = success, disparar reconcile completo de tempos.
SELECT net.http_post(
  url := 'https://stubkeeuttixteqckshd.supabase.co/functions/v1/sync-bitrix-times',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'apikey', '<SERVICE_ROLE_KEY_DO_PROJETO_STUB>',
    'Authorization', 'Bearer <SERVICE_ROLE_KEY_DO_PROJETO_STUB>'
  ),
  body := '{"full_reconcile": true}'::jsonb
) AS request_id;

-- BLOCO 4.1: conferir se tempos terminaram com sucesso.
SELECT
  source_code,
  sync_status,
  last_sync_at,
  last_success_at,
  last_error,
  details
FROM public.bonus_source_statuses
WHERE source_code = 'bitrix_elapsed_times';

SELECT
  job_name,
  status,
  started_at,
  finished_at,
  duration_ms,
  records_processed,
  error_message,
  details
FROM public.sync_job_runs
WHERE job_name = 'sync-bitrix-times'
ORDER BY started_at DESC
LIMIT 5;


-- BLOCO 5: validacoes finais.
SELECT
  source_code,
  sync_status,
  last_success_at,
  last_error,
  details
FROM public.bonus_source_statuses
WHERE source_code IN ('bitrix_tasks', 'bitrix_elapsed_times')
ORDER BY source_code;

SELECT
  job_name,
  count(*) AS running_count
FROM public.sync_job_runs
WHERE status = 'running'
  AND job_name IN ('Get-Projetcs-And-Tasks-Bitrix', 'sync-bitrix-times')
GROUP BY job_name;

SELECT
  count(*) AS operational_elapsed_rows,
  coalesce(sum(seconds), 0)::bigint AS operational_elapsed_seconds,
  round(coalesce(sum(seconds), 0) / 3600.0, 2) AS operational_elapsed_hours
FROM public.operational_elapsed_times
WHERE reference_date >= now() - interval '365 days';

SELECT
  p.id AS project_id,
  p.name AS project_name,
  coalesce(sum(et.seconds), 0)::bigint AS seconds,
  round(coalesce(sum(et.seconds), 0) / 3600.0, 2) AS hours
FROM public.operational_elapsed_times et
JOIN public.tasks t ON t.task_id = et.task_id
JOIN public.projects p ON p.id = t.project_id
WHERE et.reference_date >= now() - interval '90 days'
GROUP BY p.id, p.name
ORDER BY seconds DESC
LIMIT 20;
