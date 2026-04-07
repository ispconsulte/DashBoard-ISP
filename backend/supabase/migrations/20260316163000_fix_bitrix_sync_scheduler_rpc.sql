DROP FUNCTION IF EXISTS public.schedule_bitrix_sync_jobs(text, text, text, text);

CREATE OR REPLACE FUNCTION public.schedule_bitrix_sync_jobs(
  p_project_url text,
  p_service_role_key text,
  p_elapsed_cron text DEFAULT '*/10 * * * *',
  p_tasks_cron text DEFAULT '*/30 * * * *'
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
  SELECT 'sync-bitrix-times'::text, p_elapsed_cron, elapsed_job_id
  UNION ALL
  SELECT 'Get-Projetcs-And-Tasks-Bitrix'::text, p_tasks_cron, tasks_job_id;
END;
$$;

DROP FUNCTION IF EXISTS public.list_bitrix_sync_jobs();

CREATE OR REPLACE FUNCTION public.list_bitrix_sync_jobs()
RETURNS TABLE(sync_job_name text, sync_schedule text, sync_active boolean, sync_job_id bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    j.jobname::text AS sync_job_name,
    j.schedule::text AS sync_schedule,
    j.active AS sync_active,
    j.jobid::bigint AS sync_job_id
  FROM cron.job AS j
  WHERE j.jobname IN ('sync-bitrix-times', 'Get-Projetcs-And-Tasks-Bitrix')
  ORDER BY j.jobname;
$$;
