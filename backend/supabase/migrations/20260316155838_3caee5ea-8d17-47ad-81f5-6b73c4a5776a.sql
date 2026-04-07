
-- Create project_contracted_hours table for ROI dashboard
CREATE TABLE IF NOT EXISTS public.project_contracted_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id bigint NOT NULL UNIQUE,
  contracted_hours numeric NOT NULL DEFAULT 0,
  notes text,
  updated_by text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.project_contracted_hours ENABLE ROW LEVEL SECURITY;

-- Admin full access
DROP POLICY IF EXISTS "Admin full access project_contracted_hours" ON public.project_contracted_hours;
CREATE POLICY "Admin full access project_contracted_hours"
  ON public.project_contracted_hours
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Authenticated read
DROP POLICY IF EXISTS "Authenticated read project_contracted_hours" ON public.project_contracted_hours;
CREATE POLICY "Authenticated read project_contracted_hours"
  ON public.project_contracted_hours
  FOR SELECT
  TO authenticated
  USING (true);

-- Auto-update updated_at
DROP TRIGGER IF EXISTS update_project_contracted_hours_updated_at ON public.project_contracted_hours;
CREATE TRIGGER update_project_contracted_hours_updated_at
  BEFORE UPDATE ON public.project_contracted_hours
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
