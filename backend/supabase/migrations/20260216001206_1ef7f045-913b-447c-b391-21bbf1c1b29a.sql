
-- 1. Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'consultor', 'gerente', 'coordenador', 'cliente');

-- 2. Users table
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  user_profile TEXT NOT NULL DEFAULT 'Consultor',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 3. User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. User allowed areas
CREATE TABLE public.user_allowed_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  area_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, area_name)
);
ALTER TABLE public.user_allowed_areas ENABLE ROW LEVEL SECURITY;

-- 5. Projects table
CREATE TABLE public.projects (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- 6. User project access
CREATE TABLE public.user_project_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id BIGINT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, project_id)
);
ALTER TABLE public.user_project_access ENABLE ROW LEVEL SECURITY;

-- 7. Audit log
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  performed_by TEXT,
  target_user_id TEXT,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- 8. Helper function: has_role (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 9. Helper: is_admin
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

-- 10. Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══ RLS POLICIES ═══

-- users: self or admin
CREATE POLICY "Users can read own record" ON public.users FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Admins can insert users" ON public.users FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "Users can update own or admin all" ON public.users FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Admins can delete users" ON public.users FOR DELETE TO authenticated
  USING (public.is_admin());

-- user_roles: admin full, authenticated read own
CREATE POLICY "Read own role or admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Admin insert roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "Admin update roles" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.is_admin());
CREATE POLICY "Admin delete roles" ON public.user_roles FOR DELETE TO authenticated
  USING (public.is_admin());

-- user_allowed_areas: self read, admin full
CREATE POLICY "Read own areas or admin" ON public.user_allowed_areas FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Admin insert areas" ON public.user_allowed_areas FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "Admin delete areas" ON public.user_allowed_areas FOR DELETE TO authenticated
  USING (public.is_admin());

-- projects: admin full, users read accessible ones
CREATE POLICY "Read projects if admin or has access" ON public.projects FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.user_project_access upa WHERE upa.project_id = projects.id AND upa.user_id = auth.uid())
  );
CREATE POLICY "Admin insert projects" ON public.projects FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "Admin update projects" ON public.projects FOR UPDATE TO authenticated
  USING (public.is_admin());
CREATE POLICY "Admin delete projects" ON public.projects FOR DELETE TO authenticated
  USING (public.is_admin());

-- user_project_access: self read, admin full
CREATE POLICY "Read own project access or admin" ON public.user_project_access FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Admin insert project access" ON public.user_project_access FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "Admin delete project access" ON public.user_project_access FOR DELETE TO authenticated
  USING (public.is_admin());

-- audit_log: admin read, authenticated insert (for logging)
CREATE POLICY "Admin read audit" ON public.audit_log FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY "Authenticated insert audit" ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (true);
