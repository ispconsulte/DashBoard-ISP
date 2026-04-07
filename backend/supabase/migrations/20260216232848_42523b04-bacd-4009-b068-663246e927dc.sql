-- Add explicit denial policies for anonymous/unauthenticated access to all tables
-- This is defense-in-depth: RESTRICTIVE policies already block anon, but explicit denial is safer

-- users table: deny anon SELECT
CREATE POLICY "Deny anonymous select users"
ON public.users
FOR SELECT
TO anon
USING (false);

-- audit_log table: deny anon SELECT
CREATE POLICY "Deny anonymous select audit_log"
ON public.audit_log
FOR SELECT
TO anon
USING (false);

-- user_roles table: deny anon SELECT
CREATE POLICY "Deny anonymous select user_roles"
ON public.user_roles
FOR SELECT
TO anon
USING (false);

-- user_allowed_areas table: deny anon SELECT
CREATE POLICY "Deny anonymous select user_allowed_areas"
ON public.user_allowed_areas
FOR SELECT
TO anon
USING (false);

-- user_project_access table: deny anon SELECT
CREATE POLICY "Deny anonymous select user_project_access"
ON public.user_project_access
FOR SELECT
TO anon
USING (false);

-- projects table: deny anon SELECT
CREATE POLICY "Deny anonymous select projects"
ON public.projects
FOR SELECT
TO anon
USING (false);
