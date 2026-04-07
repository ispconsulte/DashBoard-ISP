ALTER TABLE public.client_kpis
ADD COLUMN IF NOT EXISTS cliente_id bigint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_kpis_cliente_id_fkey'
  ) THEN
    ALTER TABLE public.client_kpis
      ADD CONSTRAINT client_kpis_cliente_id_fkey
      FOREIGN KEY (cliente_id)
      REFERENCES public.clientes(cliente_id)
      ON DELETE SET NULL;
  END IF;
END $$;

UPDATE public.client_kpis ck
SET cliente_id = c.cliente_id
FROM public.clientes c
WHERE ck.cliente_id IS NULL
  AND lower(trim(ck.cliente_name)) = lower(trim(c.nome));

CREATE INDEX IF NOT EXISTS idx_client_kpis_cliente_id_month
  ON public.client_kpis (cliente_id, month DESC);

CREATE INDEX IF NOT EXISTS idx_client_kpis_cliente_name_month
  ON public.client_kpis (cliente_name, month DESC);

CREATE OR REPLACE VIEW public.sprint6_client_health_latest AS
WITH weights AS (
  SELECT
    COALESCE(weight_ebitda, 0.4) AS weight_ebitda,
    COALESCE(weight_churn, 0.3) AS weight_churn,
    COALESCE(weight_nps, 0.3) AS weight_nps
  FROM public.health_score_config
  ORDER BY updated_at DESC
  LIMIT 1
),
benchmarks AS (
  SELECT
    COALESCE(ebitda_avg, 100000) AS ebitda_avg,
    COALESCE(churn_avg, 5) AS churn_avg,
    COALESCE(nps_avg, 50) AS nps_avg
  FROM public.client_benchmarks
  ORDER BY updated_at DESC
  LIMIT 1
),
latest AS (
  SELECT DISTINCT ON (COALESCE(ck.cliente_id::text, lower(trim(ck.cliente_name))))
    ck.id,
    ck.cliente_id,
    COALESCE(NULLIF(trim(ck.cliente_name), ''), c.nome) AS cliente_name,
    ck.month,
    ck.ebitda,
    ck.churn,
    ck.nps
  FROM public.client_kpis ck
  LEFT JOIN public.clientes c
    ON c.cliente_id = ck.cliente_id
  ORDER BY COALESCE(ck.cliente_id::text, lower(trim(ck.cliente_name))), ck.month DESC, ck.updated_at DESC
)
SELECT
  latest.id,
  latest.cliente_id,
  latest.cliente_name,
  latest.month,
  latest.ebitda,
  latest.churn,
  latest.nps,
  CASE
    WHEN latest.ebitda IS NULL AND latest.churn IS NULL AND latest.nps IS NULL THEN NULL
    ELSE ROUND((
      (
        COALESCE(LEAST(CASE WHEN benchmarks.ebitda_avg > 0 THEN (latest.ebitda / benchmarks.ebitda_avg) * 50 ELSE NULL END, 100), 0) * weights.weight_ebitda
      ) +
      (
        COALESCE(GREATEST(0, LEAST(100, (1 - (latest.churn / NULLIF(benchmarks.churn_avg * 2, 0))) * 100)), 0) * weights.weight_churn
      ) +
      (
        COALESCE(GREATEST(0, LEAST(100, ((latest.nps + 100) / 200) * 100)), 0) * weights.weight_nps
      )
    ) / NULLIF(
      (CASE WHEN latest.ebitda IS NOT NULL THEN weights.weight_ebitda ELSE 0 END) +
      (CASE WHEN latest.churn IS NOT NULL THEN weights.weight_churn ELSE 0 END) +
      (CASE WHEN latest.nps IS NOT NULL THEN weights.weight_nps ELSE 0 END),
      0
    ), 1)
  END AS health_score,
  benchmarks.ebitda_avg,
  benchmarks.churn_avg,
  benchmarks.nps_avg
FROM latest
CROSS JOIN weights
CROSS JOIN benchmarks;

CREATE OR REPLACE VIEW public.sprint6_project_portfolio_base AS
SELECT
  p.id AS project_id,
  p.name AS project_name,
  p.active,
  COALESCE(pch.contracted_hours, 0) AS contracted_hours,
  pch.updated_at AS contracted_updated_at,
  COALESCE(pf.receita_projeto, 0) AS receita_projeto,
  COALESCE(pf.custo_hora, 0) AS custo_hora,
  COALESCE(pf.custo_total_estimado, 0) AS custo_total_estimado,
  pf.updated_at AS financial_updated_at
FROM public.projects p
LEFT JOIN public.project_contracted_hours pch
  ON pch.project_id = p.id
LEFT JOIN public.project_financials pf
  ON pf.project_id = p.id;

GRANT SELECT ON public.sprint6_client_health_latest TO anon, authenticated;
GRANT SELECT ON public.sprint6_project_portfolio_base TO anon, authenticated;
