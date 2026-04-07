CREATE TABLE IF NOT EXISTS public.sync_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('running', 'success', 'error')),
  triggered_by text NOT NULL DEFAULT 'manual',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sync_job_runs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sync_job_runs_job_name_started_at
ON public.sync_job_runs (job_name, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_job_runs_status_started_at
ON public.sync_job_runs (status, started_at DESC);

DROP POLICY IF EXISTS "Admins can read sync_job_runs" ON public.sync_job_runs;
CREATE POLICY "Admins can read sync_job_runs"
ON public.sync_job_runs
FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Deny anonymous select sync_job_runs" ON public.sync_job_runs;
CREATE POLICY "Deny anonymous select sync_job_runs"
ON public.sync_job_runs
FOR SELECT
TO anon
USING (false);

CREATE OR REPLACE FUNCTION public.relink_elapsed_times_to_tasks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_count integer := 0;
BEGIN
  UPDATE public.elapsed_times et
  SET
    task_id = t.task_id,
    orphan_reason = null,
    orphan_detected_at = null,
    updated_at = now()
  FROM public.tasks t
  WHERE et.task_id IS NULL
    AND et.bitrix_task_id_raw IS NOT NULL
    AND t.task_id = et.bitrix_task_id_raw;

  GET DIAGNOSTICS affected_count = ROW_COUNT;

  UPDATE public.elapsed_times
  SET
    bitrix_task_id_raw = task_id,
    updated_at = now()
  WHERE bitrix_task_id_raw IS NULL
    AND task_id IS NOT NULL;

  RETURN affected_count;
END;
$$;

SELECT public.relink_elapsed_times_to_tasks();
