
-- Restrict reponsonsibles_tasks_users: users can only see their own record
DROP POLICY IF EXISTS "Authenticated users can read reponsonsibles_tasks_users" ON public.reponsonsibles_tasks_users;

CREATE POLICY "Users can read own record in reponsonsibles_tasks_users"
  ON public.reponsonsibles_tasks_users FOR SELECT
  TO authenticated
  USING (auth.uid() = auth_user_id);
;
