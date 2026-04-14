CREATE TABLE IF NOT EXISTS public.bitrix_task_delete_events (
  task_id bigint PRIMARY KEY,
  event_name text NOT NULL DEFAULT 'OnTaskDelete',
  deleted_at timestamptz NOT NULL,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'bitrix_webhook'
);

CREATE INDEX IF NOT EXISTS idx_bitrix_task_delete_events_deleted_at
  ON public.bitrix_task_delete_events (deleted_at DESC);

ALTER TABLE public.bitrix_task_delete_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can read bitrix task delete events" ON public.bitrix_task_delete_events;
CREATE POLICY "Managers can read bitrix task delete events"
  ON public.bitrix_task_delete_events
  FOR SELECT TO authenticated
  USING (public.is_manager_role());

DROP POLICY IF EXISTS "Deny anonymous read bitrix task delete events" ON public.bitrix_task_delete_events;
CREATE POLICY "Deny anonymous read bitrix task delete events"
  ON public.bitrix_task_delete_events
  FOR SELECT TO anon
  USING (false);
