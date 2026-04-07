-- Drop the old deny policy that blocks anon reads on users
DROP POLICY IF EXISTS "Deny anonymous select users" ON public.users;

-- Allow anon to update users (for department/seniority fields in test area)
DROP POLICY IF EXISTS "Anon update users" ON public.users;
CREATE POLICY "Anon update users"
ON public.users
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);
