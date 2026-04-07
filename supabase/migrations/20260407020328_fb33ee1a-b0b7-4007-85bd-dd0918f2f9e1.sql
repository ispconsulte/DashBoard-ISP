
-- Fix project_financials: restrict read to admin or users with project access
DROP POLICY IF EXISTS "Authenticated read project_financials" ON public.project_financials;
CREATE POLICY "Authenticated read project_financials"
  ON public.project_financials FOR SELECT TO authenticated
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM public.user_project_access upa
      WHERE upa.project_id = project_financials.project_id
        AND upa.user_id = auth.uid()
    )
  );

-- Fix project_contracted_hours: restrict read to admin or users with project access
DROP POLICY IF EXISTS "Authenticated read project_contracted_hours" ON public.project_contracted_hours;
CREATE POLICY "Authenticated read project_contracted_hours"
  ON public.project_contracted_hours FOR SELECT TO authenticated
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM public.user_project_access upa
      WHERE upa.project_id = project_contracted_hours.project_id
        AND upa.user_id = auth.uid()
    )
  );
