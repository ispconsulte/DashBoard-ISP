
-- =============================================
-- Remove anonymous WRITE policies (critical!)
-- =============================================

DROP POLICY IF EXISTS "Anon write clientes" ON public.clientes;
DROP POLICY IF EXISTS "Anon write project_contracted_hours" ON public.project_contracted_hours;
DROP POLICY IF EXISTS "Anon write project_financials" ON public.project_financials;
DROP POLICY IF EXISTS "Anon write health_score_config" ON public.health_score_config;
DROP POLICY IF EXISTS "Anon write user_capacity" ON public.user_capacity;
DROP POLICY IF EXISTS "Anon write client_kpis" ON public.client_kpis;
DROP POLICY IF EXISTS "Anon write client_benchmarks" ON public.client_benchmarks;
DROP POLICY IF EXISTS "Anon update users" ON public.users;

-- =============================================
-- Remove anonymous READ policies on sensitive tables
-- =============================================

DROP POLICY IF EXISTS "Anon read users basic" ON public.users;
DROP POLICY IF EXISTS "Anon read user_capacity" ON public.user_capacity;
DROP POLICY IF EXISTS "Anon read projects" ON public.projects;
DROP POLICY IF EXISTS "Anon read clientes" ON public.clientes;
DROP POLICY IF EXISTS "Anon read project_contracted_hours" ON public.project_contracted_hours;
DROP POLICY IF EXISTS "Anon read project_financials" ON public.project_financials;
DROP POLICY IF EXISTS "Anon read health_score_config" ON public.health_score_config;
DROP POLICY IF EXISTS "Anon read client_kpis" ON public.client_kpis;
DROP POLICY IF EXISTS "Anon read client_benchmarks" ON public.client_benchmarks;
DROP POLICY IF EXISTS "Anon read task_deadline_changes" ON public.task_deadline_changes;

-- =============================================
-- Fix storage: remove public upload/update policies
-- =============================================

DROP POLICY IF EXISTS "Anyone can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update avatars" ON storage.objects;

-- =============================================
-- Add authenticated read policies where missing
-- =============================================

-- users: admin can read all, users read own (already exists)
-- No changes needed for users SELECT

-- projects: authenticated read already exists
-- No changes needed

-- clientes: authenticated read already exists
-- No changes needed

-- user_capacity: users read own already exists, add admin read all
DROP POLICY IF EXISTS "Users read own capacity" ON public.user_capacity;
CREATE POLICY "Users read own capacity or admin"
  ON public.user_capacity FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin());

-- task_deadline_changes: add authenticated read
CREATE POLICY "Authenticated users read task_deadline_changes"
  ON public.task_deadline_changes FOR SELECT TO authenticated
  USING (true);
