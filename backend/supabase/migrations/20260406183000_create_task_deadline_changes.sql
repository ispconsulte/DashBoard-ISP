CREATE TABLE IF NOT EXISTS public.task_deadline_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id bigint NOT NULL,
  previous_deadline timestamptz NULL,
  new_deadline timestamptz NULL,
  changed_by text NULL,
  change_description text NOT NULL DEFAULT 'Prazo alterado',
  detected_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_deadline_changes_task_detected
  ON public.task_deadline_changes (task_id, detected_at DESC);

ALTER TABLE public.task_deadline_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read task deadline changes" ON public.task_deadline_changes;
CREATE POLICY "Authenticated users can read task deadline changes"
  ON public.task_deadline_changes
  FOR SELECT
  TO authenticated
  USING (true);
