ALTER TABLE public.sync_job_runs
ADD COLUMN IF NOT EXISTS source text,
ADD COLUMN IF NOT EXISTS records_processed integer;

UPDATE public.sync_job_runs
SET source = COALESCE(source, job_name)
WHERE source IS NULL;

ALTER TABLE public.sync_job_runs
ALTER COLUMN source SET DEFAULT 'unknown';

ALTER TABLE public.sync_job_runs
ALTER COLUMN source SET NOT NULL;

ALTER TABLE public.sync_job_runs
DROP CONSTRAINT IF EXISTS sync_job_runs_status_check;

ALTER TABLE public.sync_job_runs
ADD CONSTRAINT sync_job_runs_status_check
CHECK (status IN ('running', 'success', 'error', 'skipped'));

CREATE INDEX IF NOT EXISTS idx_sync_job_runs_job_status_started_at
ON public.sync_job_runs (job_name, status, started_at DESC);

DROP INDEX IF EXISTS idx_sync_job_runs_running_unique;
CREATE UNIQUE INDEX idx_sync_job_runs_running_unique
ON public.sync_job_runs (job_name)
WHERE status = 'running';

DROP FUNCTION IF EXISTS public.schedule_bitrix_sync_jobs(text, text, text, text);

CREATE OR REPLACE FUNCTION public.schedule_bitrix_sync_jobs(
  p_project_url text,
  p_service_role_key text,
  p_elapsed_cron text DEFAULT '20 */4 * * *',
  p_tasks_cron text DEFAULT '0 */4 * * *'
)
RETURNS TABLE(scheduled_job_name text, scheduled_cron_expression text, scheduled_job_id bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  elapsed_job_id bigint;
  tasks_job_id bigint;
  normalized_url text;
BEGIN
  IF coalesce(trim(p_project_url), '') = '' THEN
    RAISE EXCEPTION 'project_url is required';
  END IF;

  IF coalesce(trim(p_service_role_key), '') = '' THEN
    RAISE EXCEPTION 'service_role_key is required';
  END IF;

  normalized_url := rtrim(trim(p_project_url), '/');

  PERFORM public.unschedule_sync_job('sync-bitrix-times');
  PERFORM public.unschedule_sync_job('Get-Projetcs-And-Tasks-Bitrix');

  tasks_job_id := cron.schedule(
    'Get-Projetcs-And-Tasks-Bitrix',
    p_tasks_cron,
    format(
      $job$
      select net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := %L::jsonb
      ) as request_id;
      $job$,
      normalized_url || '/functions/v1/Get-Projetcs-And-Tasks-Bitrix',
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || p_service_role_key,
        'apikey', p_service_role_key
      )::text,
      '{}'::jsonb::text
    )
  );

  elapsed_job_id := cron.schedule(
    'sync-bitrix-times',
    p_elapsed_cron,
    format(
      $job$
      select net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := %L::jsonb
      ) as request_id;
      $job$,
      normalized_url || '/functions/v1/sync-bitrix-times',
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || p_service_role_key,
        'apikey', p_service_role_key
      )::text,
      '{}'::jsonb::text
    )
  );

  INSERT INTO public.sync_job_configs (
    job_name,
    cron_expression,
    endpoint_path,
    enabled,
    request_body,
    last_scheduled_at,
    last_job_id
  )
  VALUES
    (
      'Get-Projetcs-And-Tasks-Bitrix',
      p_tasks_cron,
      '/functions/v1/Get-Projetcs-And-Tasks-Bitrix',
      true,
      '{}'::jsonb,
      now(),
      tasks_job_id
    ),
    (
      'sync-bitrix-times',
      p_elapsed_cron,
      '/functions/v1/sync-bitrix-times',
      true,
      '{}'::jsonb,
      now(),
      elapsed_job_id
    )
  ON CONFLICT (job_name) DO UPDATE SET
    cron_expression = EXCLUDED.cron_expression,
    endpoint_path = EXCLUDED.endpoint_path,
    enabled = EXCLUDED.enabled,
    request_body = EXCLUDED.request_body,
    last_scheduled_at = EXCLUDED.last_scheduled_at,
    last_job_id = EXCLUDED.last_job_id,
    updated_at = now();

  RETURN QUERY
  SELECT 'Get-Projetcs-And-Tasks-Bitrix'::text, p_tasks_cron, tasks_job_id
  UNION ALL
  SELECT 'sync-bitrix-times'::text, p_elapsed_cron, elapsed_job_id;
END;
$$;
