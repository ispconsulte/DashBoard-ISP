-- Add label and value_numeric columns to bonus_settings.
-- value_numeric is a generated stored column so callers can cast once at DB level.
-- Does NOT touch RLS policies, existing columns, or auth logic.

ALTER TABLE public.bonus_settings
  ADD COLUMN IF NOT EXISTS label         text,
  ADD COLUMN IF NOT EXISTS value_numeric numeric
    GENERATED ALWAYS AS (value::numeric) STORED;

-- Seed default config values.
-- ON CONFLICT DO NOTHING preserves any values already set by operators.
INSERT INTO public.bonus_settings (key, value, label) VALUES
  ('payout_junior',        '1000', 'Payout Júnior (R$)'),
  ('payout_pleno',         '2000', 'Payout Pleno (R$)'),
  ('payout_senior',        '3500', 'Payout Sênior (R$)'),
  ('payout_sdr',           '1200', 'Payout SDR (R$)'),
  ('payout_cro_monthly',   '1500', 'Payout CRO mensal (R$)'),
  ('threshold_ontime_pct', '95',   'Meta entregas no prazo (%)'),
  ('threshold_health_pts', '80',   'Meta health score (pts)'),
  ('threshold_margin_pct', '30',   'Meta margem por contrato (%)'),
  ('utilization_min_pct',  '70',   'Utilização mínima ideal (%)'),
  ('utilization_max_pct',  '95',   'Utilização máxima ideal (%)')
ON CONFLICT (key) DO NOTHING;
