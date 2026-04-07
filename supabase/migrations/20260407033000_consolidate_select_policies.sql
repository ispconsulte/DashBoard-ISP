-- Consolidate SELECT policies for sensitive business tables.
-- This removes any leftover broad authenticated-read policies and
-- recreates them with explicit admin or scoped-access checks.

DROP POLICY IF EXISTS "Authenticated read clientes" ON public.clientes;
CREATE POLICY "Authenticated read clientes"
  ON public.clientes FOR SELECT TO authenticated
  USING (
    is_admin() OR EXISTS (
      SELECT 1
      FROM public.user_client_access uca
      WHERE uca.cliente_id = clientes.id
        AND uca.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated read project_financials" ON public.project_financials;
CREATE POLICY "Authenticated read project_financials"
  ON public.project_financials FOR SELECT TO authenticated
  USING (
    is_admin() OR EXISTS (
      SELECT 1
      FROM public.user_project_access upa
      WHERE upa.project_id = project_financials.project_id
        AND upa.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated read project_contracted_hours" ON public.project_contracted_hours;
CREATE POLICY "Authenticated read project_contracted_hours"
  ON public.project_contracted_hours FOR SELECT TO authenticated
  USING (
    is_admin() OR EXISTS (
      SELECT 1
      FROM public.user_project_access upa
      WHERE upa.project_id = project_contracted_hours.project_id
        AND upa.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated read client_kpis" ON public.client_kpis;
CREATE POLICY "Authenticated read client_kpis"
  ON public.client_kpis FOR SELECT TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Authenticated read benchmarks" ON public.client_benchmarks;
CREATE POLICY "Authenticated read benchmarks"
  ON public.client_benchmarks FOR SELECT TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Authenticated read health_score_config" ON public.health_score_config;
CREATE POLICY "Authenticated read health_score_config"
  ON public.health_score_config FOR SELECT TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Authenticated users read task_deadline_changes" ON public.task_deadline_changes;
DROP POLICY IF EXISTS "Authenticated read task_deadline_changes" ON public.task_deadline_changes;
CREATE POLICY "Authenticated read task_deadline_changes"
  ON public.task_deadline_changes FOR SELECT TO authenticated
  USING (is_admin());
