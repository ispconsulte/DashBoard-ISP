-- Allow anon SELECT on governance tables used by Sprint 6.0 dashboards
-- These tables contain only configuration/KPI data, no PII

DROP POLICY IF EXISTS "Anon read client_kpis" ON public.client_kpis;
CREATE POLICY "Anon read client_kpis"
ON public.client_kpis
FOR SELECT
TO anon
USING (true);

DROP POLICY IF EXISTS "Anon read client_benchmarks" ON public.client_benchmarks;
CREATE POLICY "Anon read client_benchmarks"
ON public.client_benchmarks
FOR SELECT
TO anon
USING (true);

DROP POLICY IF EXISTS "Anon read health_score_config" ON public.health_score_config;
CREATE POLICY "Anon read health_score_config"
ON public.health_score_config
FOR SELECT
TO anon
USING (true);

DROP POLICY IF EXISTS "Anon read project_contracted_hours" ON public.project_contracted_hours;
CREATE POLICY "Anon read project_contracted_hours"
ON public.project_contracted_hours
FOR SELECT
TO anon
USING (true);

DROP POLICY IF EXISTS "Anon read project_financials" ON public.project_financials;
CREATE POLICY "Anon read project_financials"
ON public.project_financials
FOR SELECT
TO anon
USING (true);

DROP POLICY IF EXISTS "Anon read projects" ON public.projects;
CREATE POLICY "Anon read projects"
ON public.projects
FOR SELECT
TO anon
USING (true);

DROP POLICY IF EXISTS "Anon read users basic" ON public.users;
CREATE POLICY "Anon read users basic"
ON public.users
FOR SELECT
TO anon
USING (true);

DROP POLICY IF EXISTS "Anon read user_capacity" ON public.user_capacity;
CREATE POLICY "Anon read user_capacity"
ON public.user_capacity
FOR SELECT
TO anon
USING (true);
