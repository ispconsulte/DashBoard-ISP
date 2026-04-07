
-- 1. client_kpis: admin-only read
DROP POLICY IF EXISTS "Authenticated read client_kpis" ON public.client_kpis;
CREATE POLICY "Authenticated read client_kpis"
  ON public.client_kpis FOR SELECT TO authenticated
  USING (is_admin());

-- 2. client_benchmarks: admin-only read
DROP POLICY IF EXISTS "Authenticated read benchmarks" ON public.client_benchmarks;
CREATE POLICY "Authenticated read benchmarks"
  ON public.client_benchmarks FOR SELECT TO authenticated
  USING (is_admin());

-- 3. health_score_config: admin-only read
DROP POLICY IF EXISTS "Authenticated read health_score_config" ON public.health_score_config;
CREATE POLICY "Authenticated read health_score_config"
  ON public.health_score_config FOR SELECT TO authenticated
  USING (is_admin());

-- 4. task_deadline_changes: admin-only read + remove duplicate
DROP POLICY IF EXISTS "Authenticated read task_deadline_changes" ON public.task_deadline_changes;
DROP POLICY IF EXISTS "Authenticated users read task_deadline_changes" ON public.task_deadline_changes;
CREATE POLICY "Authenticated read task_deadline_changes"
  ON public.task_deadline_changes FOR SELECT TO authenticated
  USING (is_admin());
