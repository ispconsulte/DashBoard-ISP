-- Fix audit_log INSERT policy: deny direct inserts from regular users
-- Edge functions use service_role which bypasses RLS entirely
DROP POLICY IF EXISTS "Authenticated insert audit" ON public.audit_log;

CREATE POLICY "Deny direct audit insert"
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (false);
