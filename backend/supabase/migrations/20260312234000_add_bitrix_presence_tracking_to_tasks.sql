ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS last_seen_in_bitrix_at timestamptz;

ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS missing_from_bitrix_since timestamptz;

CREATE INDEX IF NOT EXISTS idx_tasks_last_seen_in_bitrix_at
ON public.tasks (last_seen_in_bitrix_at);

CREATE INDEX IF NOT EXISTS idx_tasks_missing_from_bitrix_since
ON public.tasks (missing_from_bitrix_since);
