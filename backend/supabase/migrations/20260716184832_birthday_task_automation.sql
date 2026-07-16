-- Persistent state for the Python-driven birthday scheduler and idempotent
-- identity for every employee/birthday cycle. Reversal is documented below.

CREATE TABLE IF NOT EXISTS public.birthday_task_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bitrix_user_id text NOT NULL,
  employee_name text NOT NULL,
  birth_date date NOT NULL,
  cycle_year integer NOT NULL CHECK (cycle_year BETWEEN 2000 AND 2200),
  cycle_month integer NOT NULL CHECK (cycle_month BETWEEN 1 AND 12),
  title text NOT NULL,
  bitrix_task_id text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'created', 'error')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error text,
  lock_token uuid,
  trigger_source text NOT NULL DEFAULT 'scheduled'
    CHECK (trigger_source IN ('scheduled', 'manual')),
  triggered_by uuid,
  triggered_by_email text,
  forced_early boolean NOT NULL DEFAULT false,
  created_in_bitrix_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bitrix_user_id, cycle_year, cycle_month)
);

CREATE INDEX IF NOT EXISTS idx_birthday_task_cycles_status_updated
  ON public.birthday_task_cycles (status, updated_at);

CREATE TABLE IF NOT EXISTS public.birthday_automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('scheduled', 'manual')),
  status text NOT NULL CHECK (status IN ('running', 'success', 'partial', 'error', 'noop')),
  requested_by uuid,
  requested_by_email text,
  target_periods text[] NOT NULL DEFAULT '{}',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text
);

CREATE INDEX IF NOT EXISTS idx_birthday_automation_runs_started
  ON public.birthday_automation_runs (started_at DESC);

CREATE TABLE IF NOT EXISTS public.birthday_automation_state (
  scheduler_key text PRIMARY KEY CHECK (scheduler_key = 'birthday-reminders'),
  last_completed_cycle date,
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_success_at timestamptz,
  last_status text CHECK (last_status IN ('running', 'success', 'partial', 'error', 'noop')),
  last_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.birthday_task_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.birthday_automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.birthday_automation_state ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.birthday_task_cycles FROM anon, authenticated;
REVOKE ALL ON TABLE public.birthday_automation_runs FROM anon, authenticated;
REVOKE ALL ON TABLE public.birthday_automation_state FROM anon, authenticated;

COMMENT ON TABLE public.birthday_task_cycles IS
  'Idempotent Bitrix task identity for each employee birthday cycle.';
COMMENT ON TABLE public.birthday_automation_runs IS
  'Operational run history for scheduled and administrator-triggered birthday tasks.';
COMMENT ON TABLE public.birthday_automation_state IS
  'Catch-up cursor and health summary for the authoritative Python scheduler.';

-- Reversal, if needed:
-- DROP TABLE IF EXISTS public.birthday_automation_state;
-- DROP TABLE IF EXISTS public.birthday_automation_runs;
-- DROP TABLE IF EXISTS public.birthday_task_cycles;
