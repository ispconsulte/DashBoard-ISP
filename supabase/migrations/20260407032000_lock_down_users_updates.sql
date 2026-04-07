-- Lock down direct writes to public.users from client-facing roles.
-- User management already goes through the manage-user edge function
-- using service_role, so authenticated/anon should not update this table.

DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND cmd = 'UPDATE'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.users',
      policy_record.policyname
    );
  END LOOP;
END $$;

REVOKE UPDATE ON TABLE public.users FROM anon;
REVOKE UPDATE ON TABLE public.users FROM authenticated;

-- Keep privileged server-side workflows working.
GRANT UPDATE ON TABLE public.users TO service_role;
