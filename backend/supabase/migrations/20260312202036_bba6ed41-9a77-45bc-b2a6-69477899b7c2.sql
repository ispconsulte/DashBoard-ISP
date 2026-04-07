-- Fix: Add WITH CHECK to users UPDATE policy to prevent self-reactivation and identity field changes
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
$$;

DROP POLICY IF EXISTS "Users can update own or admin all" ON public.users;

CREATE POLICY "Users can update own or admin all"
ON public.users
FOR UPDATE
TO authenticated
USING ((auth_user_id = auth.uid()) OR public.is_admin())
WITH CHECK (
  CASE
    WHEN public.is_admin() THEN true
    ELSE (
      auth_user_id = auth.uid()
      AND auth_user_id = auth.uid()  -- prevent changing auth_user_id
      AND active = true              -- prevent self-reactivation
    )
  END
);
