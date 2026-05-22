-- Required for live updates when the bonus responsible user changes.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'bonus_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bonus_settings;
  END IF;
END $$;
