
CREATE TABLE public.project_financials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id bigint NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  receita_projeto numeric DEFAULT 0,
  custo_hora numeric DEFAULT 0,
  custo_total_estimado numeric DEFAULT 0,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id)
);

ALTER TABLE public.project_financials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access project_financials"
  ON public.project_financials
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Authenticated read project_financials"
  ON public.project_financials
  FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER update_project_financials_updated_at
  BEFORE UPDATE ON public.project_financials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
