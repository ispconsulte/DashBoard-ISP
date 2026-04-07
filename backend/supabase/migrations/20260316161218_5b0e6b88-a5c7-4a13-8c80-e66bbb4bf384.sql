
-- Single-row config table for health score weights
CREATE TABLE IF NOT EXISTS public.health_score_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weight_ebitda numeric NOT NULL DEFAULT 0.4,
  weight_churn numeric NOT NULL DEFAULT 0.3,
  weight_nps numeric NOT NULL DEFAULT 0.3,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by text
);

-- RLS
ALTER TABLE public.health_score_config ENABLE ROW LEVEL SECURITY;

-- Admin full access
DROP POLICY IF EXISTS "Admin full access health_score_config" ON public.health_score_config;
CREATE POLICY "Admin full access health_score_config"
  ON public.health_score_config
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Authenticated read
DROP POLICY IF EXISTS "Authenticated read health_score_config" ON public.health_score_config;
CREATE POLICY "Authenticated read health_score_config"
  ON public.health_score_config
  FOR SELECT
  TO authenticated
  USING (true);

-- Auto-update updated_at
DROP TRIGGER IF EXISTS update_health_score_config_updated_at ON public.health_score_config;
CREATE TRIGGER update_health_score_config_updated_at
  BEFORE UPDATE ON public.health_score_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default row
INSERT INTO public.health_score_config (weight_ebitda, weight_churn, weight_nps)
SELECT 0.4, 0.3, 0.3
WHERE NOT EXISTS (SELECT 1 FROM public.health_score_config);
