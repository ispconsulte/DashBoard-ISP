ALTER TABLE public.elapsed_times
ADD COLUMN IF NOT EXISTS bitrix_task_id_raw bigint;

ALTER TABLE public.elapsed_times
ADD COLUMN IF NOT EXISTS orphan_reason text;

ALTER TABLE public.elapsed_times
ADD COLUMN IF NOT EXISTS orphan_detected_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_elapsed_times_bitrix_task_id_raw
ON public.elapsed_times (bitrix_task_id_raw);

CREATE INDEX IF NOT EXISTS idx_elapsed_times_orphan_reason
ON public.elapsed_times (orphan_reason);
