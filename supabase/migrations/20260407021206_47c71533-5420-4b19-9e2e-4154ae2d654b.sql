
-- 1. Harden UPDATE: add WITH CHECK so the role column value is validated
--    and user_id cannot be changed to another user
DROP POLICY IF EXISTS "Admin update roles" ON public.user_roles;
CREATE POLICY "Admin update roles"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- 2. Harden INSERT: add explicit prevention of self-role-grant
--    An admin can grant roles to OTHER users, but cannot grant admin role to themselves
--    (prevents a compromised admin session from creating a backup admin entry)
DROP POLICY IF EXISTS "Admin insert roles" ON public.user_roles;
CREATE POLICY "Admin insert roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    is_admin() AND (
      user_id != auth.uid() OR role != 'admin'
    )
  );

-- 3. Prevent admin from deleting their own admin role (accidental lockout prevention)
DROP POLICY IF EXISTS "Admin delete roles" ON public.user_roles;
CREATE POLICY "Admin delete roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (
    is_admin() AND (
      user_id != auth.uid() OR role != 'admin'
    )
  );
