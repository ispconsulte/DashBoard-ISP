-- Drop old deny policies that block anon on tables that now need anon access
DROP POLICY IF EXISTS "Deny anonymous select user_project_access" ON public.user_project_access;
DROP POLICY IF EXISTS "Deny anonymous select user_allowed_areas" ON public.user_allowed_areas;
DROP POLICY IF EXISTS "Deny anonymous select user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Deny anonymous select audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "Deny anonymous select projects" ON public.projects;