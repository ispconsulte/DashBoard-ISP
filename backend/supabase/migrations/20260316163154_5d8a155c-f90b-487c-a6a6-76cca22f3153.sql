-- Allow anon write on governance tables for admin forms (Sprint 6.0 test area)
-- Write access is controlled at the application level (admin-only pages)

DROP POLICY IF EXISTS "Anon write client_kpis" ON public.client_kpis;
CREATE POLICY "Anon write client_kpis"
ON public.client_kpis
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Anon write client_benchmarks" ON public.client_benchmarks;
CREATE POLICY "Anon write client_benchmarks"
ON public.client_benchmarks
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Anon write health_score_config" ON public.health_score_config;
CREATE POLICY "Anon write health_score_config"
ON public.health_score_config
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Anon write project_contracted_hours" ON public.project_contracted_hours;
CREATE POLICY "Anon write project_contracted_hours"
ON public.project_contracted_hours
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Anon write project_financials" ON public.project_financials;
CREATE POLICY "Anon write project_financials"
ON public.project_financials
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Anon write user_capacity" ON public.user_capacity;
CREATE POLICY "Anon write user_capacity"
ON public.user_capacity
FOR ALL
TO anon
USING (true)
WITH CHECK (true);
