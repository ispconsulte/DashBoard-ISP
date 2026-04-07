
-- Add department and seniority_level to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department text DEFAULT NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS seniority_level text DEFAULT NULL;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create user_capacity table for available hours per user per month
CREATE TABLE IF NOT EXISTS public.user_capacity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  month text NOT NULL,
  available_hours numeric NOT NULL DEFAULT 160,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, month)
);

ALTER TABLE public.user_capacity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access user_capacity" ON public.user_capacity
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Users read own capacity" ON public.user_capacity
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Create client_kpis table for manual KPI input
CREATE TABLE IF NOT EXISTS public.client_kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_name text NOT NULL,
  month text NOT NULL,
  ebitda numeric DEFAULT NULL,
  churn numeric DEFAULT NULL,
  nps numeric DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cliente_name, month)
);

ALTER TABLE public.client_kpis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access client_kpis" ON public.client_kpis
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Create client_benchmarks table for sector averages
CREATE TABLE IF NOT EXISTS public.client_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ebitda_avg numeric DEFAULT NULL,
  churn_avg numeric DEFAULT NULL,
  nps_avg numeric DEFAULT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access client_benchmarks" ON public.client_benchmarks
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Authenticated read benchmarks" ON public.client_benchmarks
  FOR SELECT TO authenticated USING (true);

-- Trigger for updated_at on new tables
CREATE TRIGGER update_user_capacity_updated_at
  BEFORE UPDATE ON public.user_capacity
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_kpis_updated_at
  BEFORE UPDATE ON public.client_kpis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_benchmarks_updated_at
  BEFORE UPDATE ON public.client_benchmarks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
