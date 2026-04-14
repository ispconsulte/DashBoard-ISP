CREATE OR REPLACE FUNCTION public.is_manager_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'gerente', 'coordenador')
  )
  OR EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND lower(coalesce(u.user_profile::text, '')) IN ('administrador', 'gerente', 'coordenador')
  );
$$;

CREATE TABLE IF NOT EXISTS public.task_diagnostic_controls (
  task_id bigint PRIMARY KEY,
  visibility_mode text NOT NULL DEFAULT 'diagnostic_only'
    CHECK (visibility_mode IN ('diagnostic_only', 'show_in_operations')),
  review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'reviewing', 'resolved', 'ignored')),
  admin_note text NULL,
  updated_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.elapsed_diagnostic_controls (
  elapsed_id bigint PRIMARY KEY,
  visibility_mode text NOT NULL DEFAULT 'diagnostic_only'
    CHECK (visibility_mode IN ('diagnostic_only', 'show_in_operations')),
  review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'reviewing', 'resolved', 'ignored')),
  admin_note text NULL,
  updated_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_diagnostic_controls_visibility
  ON public.task_diagnostic_controls (visibility_mode, review_status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_elapsed_diagnostic_controls_visibility
  ON public.elapsed_diagnostic_controls (visibility_mode, review_status, updated_at DESC);

ALTER TABLE public.task_diagnostic_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elapsed_diagnostic_controls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read task diagnostic controls" ON public.task_diagnostic_controls;
CREATE POLICY "Authenticated read task diagnostic controls"
  ON public.task_diagnostic_controls
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Managers manage task diagnostic controls" ON public.task_diagnostic_controls;
CREATE POLICY "Managers manage task diagnostic controls"
  ON public.task_diagnostic_controls
  FOR ALL TO authenticated
  USING (public.is_manager_role())
  WITH CHECK (public.is_manager_role());

DROP POLICY IF EXISTS "Deny anonymous read task diagnostic controls" ON public.task_diagnostic_controls;
CREATE POLICY "Deny anonymous read task diagnostic controls"
  ON public.task_diagnostic_controls
  FOR SELECT TO anon
  USING (false);

DROP POLICY IF EXISTS "Authenticated read elapsed diagnostic controls" ON public.elapsed_diagnostic_controls;
CREATE POLICY "Authenticated read elapsed diagnostic controls"
  ON public.elapsed_diagnostic_controls
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Managers manage elapsed diagnostic controls" ON public.elapsed_diagnostic_controls;
CREATE POLICY "Managers manage elapsed diagnostic controls"
  ON public.elapsed_diagnostic_controls
  FOR ALL TO authenticated
  USING (public.is_manager_role())
  WITH CHECK (public.is_manager_role());

DROP POLICY IF EXISTS "Deny anonymous read elapsed diagnostic controls" ON public.elapsed_diagnostic_controls;
CREATE POLICY "Deny anonymous read elapsed diagnostic controls"
  ON public.elapsed_diagnostic_controls
  FOR SELECT TO anon
  USING (false);

DROP TRIGGER IF EXISTS update_task_diagnostic_controls_updated_at ON public.task_diagnostic_controls;
CREATE TRIGGER update_task_diagnostic_controls_updated_at
  BEFORE UPDATE ON public.task_diagnostic_controls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_elapsed_diagnostic_controls_updated_at ON public.elapsed_diagnostic_controls;
CREATE TRIGGER update_elapsed_diagnostic_controls_updated_at
  BEFORE UPDATE ON public.elapsed_diagnostic_controls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
