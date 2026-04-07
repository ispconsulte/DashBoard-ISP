
CREATE TABLE public.task_deadline_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id bigint NOT NULL,
  task_title text,
  previous_deadline timestamptz,
  new_deadline timestamptz,
  changed_by text,
  change_description text NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  sync_run_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_deadline_changes_task_id ON public.task_deadline_changes (task_id);
CREATE INDEX idx_task_deadline_changes_detected_at ON public.task_deadline_changes (detected_at DESC);

-- Unique constraint to prevent duplicate records for the same deadline change event
CREATE UNIQUE INDEX idx_task_deadline_changes_unique_event 
  ON public.task_deadline_changes (task_id, COALESCE(previous_deadline, '1970-01-01'::timestamptz), COALESCE(new_deadline, '1970-01-01'::timestamptz));

ALTER TABLE public.task_deadline_changes ENABLE ROW LEVEL SECURITY;

-- Read access for authenticated users
CREATE POLICY "Authenticated read task_deadline_changes"
  ON public.task_deadline_changes FOR SELECT TO authenticated
  USING (true);

-- Anon read for external supabase client
CREATE POLICY "Anon read task_deadline_changes"
  ON public.task_deadline_changes FOR SELECT TO anon
  USING (true);

-- Service role writes via edge function (no insert policy needed for service_role)
