CREATE TABLE IF NOT EXISTS public.bonus_score_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_kind text NOT NULL
    CHECK (snapshot_kind IN ('consultant_monthly', 'commercial_monthly', 'revenue_quarterly')),
  period_type text NOT NULL
    CHECK (period_type IN ('month', 'quarter')),
  period_key text NOT NULL,
  subject_key text NOT NULL CHECK (length(trim(subject_key)) > 0),
  user_id bigint NULL REFERENCES public.users(id) ON DELETE SET NULL,
  subject_role text NULL,
  score numeric NOT NULL,
  payout_amount numeric NULL,
  max_payout_amount numeric NULL,
  sync_status text NOT NULL DEFAULT 'calculated'
    CHECK (sync_status IN ('pending', 'synced', 'partial', 'manual', 'calculated', 'error')),
  source_provenance text NOT NULL DEFAULT 'calculated'
    CHECK (source_provenance IN ('bitrix', 'manual', 'calculated', 'mixed')),
  source_updated_at timestamptz NULL,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  calculation_version text NULL,
  explanation jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bonus_score_snapshots_period_shape_chk CHECK (
    (snapshot_kind IN ('consultant_monthly', 'commercial_monthly') AND period_type = 'month')
    OR (snapshot_kind = 'revenue_quarterly' AND period_type = 'quarter')
  ),
  CONSTRAINT bonus_score_snapshots_user_requirement_chk CHECK (
    snapshot_kind = 'revenue_quarterly' OR user_id IS NOT NULL
  ),
  CONSTRAINT bonus_score_snapshots_score_chk CHECK (score >= 0 AND score <= 100),
  CONSTRAINT bonus_score_snapshots_payout_chk CHECK (
    payout_amount IS NULL OR payout_amount >= 0
  ),
  CONSTRAINT bonus_score_snapshots_max_payout_chk CHECK (
    max_payout_amount IS NULL OR max_payout_amount >= 0
  ),
  CONSTRAINT bonus_score_snapshots_unique_subject UNIQUE (snapshot_kind, period_key, subject_key)
);

CREATE TABLE IF NOT EXISTS public.bonus_metric_breakdowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES public.bonus_score_snapshots(id) ON DELETE CASCADE,
  metric_code text NOT NULL,
  metric_label text NOT NULL,
  metric_group text NULL,
  metric_value numeric NULL,
  metric_target numeric NULL,
  metric_unit text NULL,
  meets_target boolean NULL,
  source_provenance text NOT NULL DEFAULT 'calculated'
    CHECK (source_provenance IN ('bitrix', 'manual', 'calculated', 'mixed')),
  source_entity text NULL,
  source_record_key text NULL,
  source_updated_at timestamptz NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bonus_metric_breakdowns_metric_code_chk CHECK (length(trim(metric_code)) > 0),
  CONSTRAINT bonus_metric_breakdowns_metric_label_chk CHECK (length(trim(metric_label)) > 0),
  CONSTRAINT bonus_metric_breakdowns_unique_metric UNIQUE (snapshot_id, metric_code)
);

CREATE TABLE IF NOT EXISTS public.bonus_internal_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_scope text NOT NULL
    CHECK (evaluation_scope IN ('consultant', 'client', 'project')),
  period_type text NOT NULL DEFAULT 'month'
    CHECK (period_type = 'month'),
  period_key text NOT NULL,
  user_id bigint NULL REFERENCES public.users(id) ON DELETE SET NULL,
  cliente_id bigint NULL REFERENCES public.clientes(cliente_id) ON DELETE SET NULL,
  project_id integer NULL REFERENCES public.projects(id) ON DELETE SET NULL,
  evaluator_user_id bigint NULL REFERENCES public.users(id) ON DELETE SET NULL,
  soft_skill_score numeric NULL,
  people_skill_score numeric NULL,
  nps_score numeric NULL,
  notes text NULL,
  source_provenance text NOT NULL DEFAULT 'manual'
    CHECK (source_provenance IN ('bitrix', 'manual', 'calculated', 'mixed')),
  source_form text NULL,
  source_updated_at timestamptz NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bonus_internal_evaluations_subject_scope_chk CHECK (
    (evaluation_scope = 'consultant' AND user_id IS NOT NULL AND cliente_id IS NULL AND project_id IS NULL)
    OR (evaluation_scope = 'client' AND user_id IS NULL AND cliente_id IS NOT NULL AND project_id IS NULL)
    OR (evaluation_scope = 'project' AND user_id IS NULL AND cliente_id IS NULL AND project_id IS NOT NULL)
  ),
  CONSTRAINT bonus_internal_evaluations_payload_chk CHECK (
    soft_skill_score IS NOT NULL OR people_skill_score IS NOT NULL OR nps_score IS NOT NULL
  ),
  CONSTRAINT bonus_internal_evaluations_soft_skill_chk CHECK (
    soft_skill_score IS NULL OR (soft_skill_score >= 0 AND soft_skill_score <= 100)
  ),
  CONSTRAINT bonus_internal_evaluations_people_skill_chk CHECK (
    people_skill_score IS NULL OR (people_skill_score >= 0 AND people_skill_score <= 100)
  ),
  CONSTRAINT bonus_internal_evaluations_nps_chk CHECK (
    nps_score IS NULL OR (nps_score >= -100 AND nps_score <= 100)
  )
);

CREATE TABLE IF NOT EXISTS public.bonus_source_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_code text NOT NULL UNIQUE CHECK (length(trim(source_code)) > 0),
  source_name text NOT NULL CHECK (length(trim(source_name)) > 0),
  source_kind text NOT NULL
    CHECK (source_kind IN ('bitrix', 'manual', 'calculated', 'mixed')),
  entity_name text NOT NULL CHECK (length(trim(entity_name)) > 0),
  sync_status text NOT NULL
    CHECK (sync_status IN ('idle', 'running', 'success', 'partial', 'error', 'manual')),
  last_sync_at timestamptz NULL,
  last_success_at timestamptz NULL,
  last_error text NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bonus_source_statuses_success_order_chk CHECK (
    last_success_at IS NULL OR last_sync_at IS NULL OR last_success_at <= last_sync_at
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bonus_internal_evaluations_consultant_period
  ON public.bonus_internal_evaluations (period_key, user_id, COALESCE(evaluator_user_id, 0))
  WHERE evaluation_scope = 'consultant';

CREATE UNIQUE INDEX IF NOT EXISTS idx_bonus_internal_evaluations_client_period
  ON public.bonus_internal_evaluations (period_key, cliente_id, COALESCE(evaluator_user_id, 0))
  WHERE evaluation_scope = 'client';

CREATE UNIQUE INDEX IF NOT EXISTS idx_bonus_internal_evaluations_project_period
  ON public.bonus_internal_evaluations (period_key, project_id, COALESCE(evaluator_user_id, 0))
  WHERE evaluation_scope = 'project';

CREATE INDEX IF NOT EXISTS idx_bonus_score_snapshots_period_kind
  ON public.bonus_score_snapshots (period_type, period_key, snapshot_kind);

CREATE INDEX IF NOT EXISTS idx_bonus_score_snapshots_user_period
  ON public.bonus_score_snapshots (user_id, period_key);

CREATE INDEX IF NOT EXISTS idx_bonus_score_snapshots_source_sync
  ON public.bonus_score_snapshots (source_provenance, sync_status, source_updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_bonus_metric_breakdowns_snapshot
  ON public.bonus_metric_breakdowns (snapshot_id, metric_group, metric_code);

CREATE INDEX IF NOT EXISTS idx_bonus_metric_breakdowns_source
  ON public.bonus_metric_breakdowns (source_provenance, source_entity);

CREATE INDEX IF NOT EXISTS idx_bonus_source_statuses_kind_status
  ON public.bonus_source_statuses (source_kind, sync_status, last_sync_at DESC);

ALTER TABLE public.bonus_score_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonus_metric_breakdowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonus_internal_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonus_source_statuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access bonus_score_snapshots" ON public.bonus_score_snapshots;
CREATE POLICY "Admin full access bonus_score_snapshots"
  ON public.bonus_score_snapshots
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Authenticated read bonus_score_snapshots" ON public.bonus_score_snapshots;
CREATE POLICY "Authenticated read bonus_score_snapshots"
  ON public.bonus_score_snapshots
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anon read bonus_score_snapshots" ON public.bonus_score_snapshots;
CREATE POLICY "Anon read bonus_score_snapshots"
  ON public.bonus_score_snapshots
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "Admin full access bonus_metric_breakdowns" ON public.bonus_metric_breakdowns;
CREATE POLICY "Admin full access bonus_metric_breakdowns"
  ON public.bonus_metric_breakdowns
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Authenticated read bonus_metric_breakdowns" ON public.bonus_metric_breakdowns;
CREATE POLICY "Authenticated read bonus_metric_breakdowns"
  ON public.bonus_metric_breakdowns
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anon read bonus_metric_breakdowns" ON public.bonus_metric_breakdowns;
CREATE POLICY "Anon read bonus_metric_breakdowns"
  ON public.bonus_metric_breakdowns
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "Admin full access bonus_internal_evaluations" ON public.bonus_internal_evaluations;
CREATE POLICY "Admin full access bonus_internal_evaluations"
  ON public.bonus_internal_evaluations
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Authenticated read bonus_internal_evaluations" ON public.bonus_internal_evaluations;
CREATE POLICY "Authenticated read bonus_internal_evaluations"
  ON public.bonus_internal_evaluations
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anon read bonus_internal_evaluations" ON public.bonus_internal_evaluations;
CREATE POLICY "Anon read bonus_internal_evaluations"
  ON public.bonus_internal_evaluations
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "Admin full access bonus_source_statuses" ON public.bonus_source_statuses;
CREATE POLICY "Admin full access bonus_source_statuses"
  ON public.bonus_source_statuses
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Authenticated read bonus_source_statuses" ON public.bonus_source_statuses;
CREATE POLICY "Authenticated read bonus_source_statuses"
  ON public.bonus_source_statuses
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anon read bonus_source_statuses" ON public.bonus_source_statuses;
CREATE POLICY "Anon read bonus_source_statuses"
  ON public.bonus_source_statuses
  FOR SELECT TO anon
  USING (true);

DROP TRIGGER IF EXISTS update_bonus_score_snapshots_updated_at ON public.bonus_score_snapshots;
CREATE TRIGGER update_bonus_score_snapshots_updated_at
  BEFORE UPDATE ON public.bonus_score_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_bonus_metric_breakdowns_updated_at ON public.bonus_metric_breakdowns;
CREATE TRIGGER update_bonus_metric_breakdowns_updated_at
  BEFORE UPDATE ON public.bonus_metric_breakdowns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_bonus_internal_evaluations_updated_at ON public.bonus_internal_evaluations;
CREATE TRIGGER update_bonus_internal_evaluations_updated_at
  BEFORE UPDATE ON public.bonus_internal_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_bonus_source_statuses_updated_at ON public.bonus_source_statuses;
CREATE TRIGGER update_bonus_source_statuses_updated_at
  BEFORE UPDATE ON public.bonus_source_statuses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
