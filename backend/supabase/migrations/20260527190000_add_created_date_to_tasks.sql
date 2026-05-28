-- Persist Bitrix task creation date so period filters can use CREATED_DATE.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS created_date timestamptz;

CREATE INDEX IF NOT EXISTS idx_tasks_created_date
  ON public.tasks (created_date DESC);
