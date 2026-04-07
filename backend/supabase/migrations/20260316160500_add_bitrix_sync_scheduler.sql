CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS public.sync_job_configs (
  job_name text PRIMARY KEY,
  cron_expression text NOT NULL,
  endpoint_path text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  request_body jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_scheduled_at timestamptz,
  last_job_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sync_job_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read sync_job_configs" ON public.sync_job_configs;
CREATE POLICY "Admins can read sync_job_configs"
ON public.sync_job_configs
FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Deny anonymous select sync_job_configs" ON public.sync_job_configs;
CREATE POLICY "Deny anonymous select sync_job_configs"
ON public.sync_job_configs
FOR SELECT
TO anon
USING (false);

DROP TRIGGER IF EXISTS update_sync_job_configs_updated_at ON public.sync_job_configs;
CREATE TRIGGER update_sync_job_configs_updated_at
  BEFORE UPDATE ON public.sync_job_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.unschedule_sync_job(p_job_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  scheduled_job record;
BEGIN
  FOR scheduled_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = p_job_name
  LOOP
    PERFORM cron.unschedule(scheduled_job.jobid);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.schedule_bitrix_sync_jobs(
  p_project_url text,
  p_service_role_key text,
  p_elapsed_cron text DEFAULT '*/10 * * * *',
  p_tasks_cron text DEFAULT '*/30 * * * *'
)
RETURNS TABLE(job_name text, cron_expression text, job_id bigint)
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
      'sync-bitrix-times',
      p_elapsed_cron,
      '/functions/v1/sync-bitrix-times',
      true,
      '{}'::jsonb,
      now(),
      elapsed_job_id
    ),
    (
      'Get-Projetcs-And-Tasks-Bitrix',
      p_tasks_cron,
      '/functions/v1/Get-Projetcs-And-Tasks-Bitrix',
      true,
      '{}'::jsonb,
      now(),
      tasks_job_id
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
  SELECT 'sync-bitrix-times', p_elapsed_cron, elapsed_job_id
  UNION ALL
  SELECT 'Get-Projetcs-And-Tasks-Bitrix', p_tasks_cron, tasks_job_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_bitrix_sync_jobs()
RETURNS TABLE(job_name text, schedule text, active boolean, job_id bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    jobname::text AS job_name,
    schedule::text,
    active,
    jobid::bigint AS job_id
  FROM cron.job
  WHERE jobname IN ('sync-bitrix-times', 'Get-Projetcs-And-Tasks-Bitrix')
  ORDER BY jobname;
$$;
