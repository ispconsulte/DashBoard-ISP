ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS real_status integer,
ADD COLUMN IF NOT EXISTS changed_date timestamptz,
ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
ADD COLUMN IF NOT EXISTS bitrix_visible boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS project_closed boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS local_state text NOT NULL DEFAULT 'active';

ALTER TABLE public.tasks
DROP CONSTRAINT IF EXISTS tasks_local_state_check;

ALTER TABLE public.tasks
ADD CONSTRAINT tasks_local_state_check
CHECK (local_state IN ('active', 'deleted_confirmed', 'project_archived', 'not_found_or_no_access', 'stale_not_seen'));

UPDATE public.tasks
SET real_status = COALESCE(real_status, status),
    last_seen_at = COALESCE(last_seen_at, last_seen_in_bitrix_at),
    local_state = CASE
      WHEN COALESCE(project_closed, false) = true THEN 'project_archived'
      WHEN missing_from_bitrix_since IS NOT NULL THEN 'not_found_or_no_access'
      ELSE 'active'
    END
WHERE real_status IS NULL
   OR last_seen_at IS NULL
   OR local_state IS NULL
   OR local_state = '';

CREATE INDEX IF NOT EXISTS idx_tasks_local_state ON public.tasks (local_state, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_bitrix_visible ON public.tasks (bitrix_visible, local_state);

ALTER TABLE public.elapsed_times
ADD COLUMN IF NOT EXISTS local_state text NOT NULL DEFAULT 'active',
ADD COLUMN IF NOT EXISTS orphan_detail text,
ADD COLUMN IF NOT EXISTS is_manual_backdated boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS reference_date timestamptz;

ALTER TABLE public.elapsed_times
DROP CONSTRAINT IF EXISTS elapsed_times_local_state_check;

ALTER TABLE public.elapsed_times
ADD CONSTRAINT elapsed_times_local_state_check
CHECK (local_state IN ('active', 'deleted_confirmed', 'project_archived', 'not_found_or_no_access', 'orphan_time_entry'));

UPDATE public.elapsed_times
SET local_state = CASE
      WHEN orphan_reason IS NOT NULL THEN 'orphan_time_entry'
      ELSE 'active'
    END,
    orphan_detail = COALESCE(orphan_detail, orphan_reason),
    is_manual_backdated = CASE
      WHEN date_start IS NOT NULL
       AND date_stop IS NOT NULL
       AND date_start = date_stop
       AND COALESCE(seconds, 0) > 0
      THEN true
      ELSE COALESCE(is_manual_backdated, false)
    END,
    reference_date = COALESCE(reference_date, created_date, date_start, date_stop, updated_at);

CREATE INDEX IF NOT EXISTS idx_elapsed_times_local_state
  ON public.elapsed_times (local_state, reference_date DESC);

CREATE INDEX IF NOT EXISTS idx_elapsed_times_reference_date
  ON public.elapsed_times (reference_date DESC);
