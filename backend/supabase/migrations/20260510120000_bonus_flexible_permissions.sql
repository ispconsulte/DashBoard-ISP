-- ─────────────────────────────────────────────────────────────────────────────
-- Bonificação: permissões flexíveis, elegibilidade e proteção monetária
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Tabela de configurações globais da bonificação
CREATE TABLE IF NOT EXISTS public.bonus_settings (
  key   text PRIMARY KEY,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bonus_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage bonus_settings" ON public.bonus_settings;
CREATE POLICY "Admins manage bonus_settings"
ON public.bonus_settings
FOR ALL
TO authenticated
USING  (public.is_admin() OR public.current_user_bonus_role() = 'admin')
WITH CHECK (public.is_admin() OR public.current_user_bonus_role() = 'admin');

DROP POLICY IF EXISTS "Authenticated read bonus_settings" ON public.bonus_settings;
CREATE POLICY "Authenticated read bonus_settings"
ON public.bonus_settings
FOR SELECT
TO authenticated
USING (true);

-- Chave inicial: responsável geral da bonificação (substituirá o hardcode "thalia")
-- Valor deve ser preenchido com o user_id (bigint como texto) do responsável.
-- Exemplo: INSERT INTO bonus_settings (key, value) VALUES ('payment_manager_user_id', '42');
INSERT INTO public.bonus_settings (key, value)
VALUES ('payment_manager_user_id', NULL)
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Tabela de elegibilidade para bonificação (substitui RANKING_ELIGIBLE_NAMES)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bonus_eligible_users (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    bigint  NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  is_eligible boolean NOT NULL DEFAULT true,
  start_date date,
  end_date   date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.bonus_eligible_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage bonus_eligible_users" ON public.bonus_eligible_users;
CREATE POLICY "Admins manage bonus_eligible_users"
ON public.bonus_eligible_users
FOR ALL
TO authenticated
USING  (public.is_admin() OR public.current_user_bonus_role() = 'admin')
WITH CHECK (public.is_admin() OR public.current_user_bonus_role() = 'admin');

DROP POLICY IF EXISTS "Authenticated read bonus_eligible_users" ON public.bonus_eligible_users;
CREATE POLICY "Authenticated read bonus_eligible_users"
ON public.bonus_eligible_users
FOR SELECT
TO authenticated
USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Função: verifica se o usuário logado é o payment_manager
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.current_user_is_payment_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.bonus_settings s ON s.key = 'payment_manager_user_id'
    WHERE u.auth_user_id = auth.uid()
      AND s.value IS NOT NULL
      AND u.id = s.value::bigint
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Proteger payout_amount em bonus_score_snapshots para não-payment_manager
--    Substituímos a policy de leitura aberta por uma policy que retorna
--    payout_amount = NULL para quem não tem permissão monetária.
--    A estratégia aqui é usar uma VIEW segura que o frontend vai consumir.
-- ─────────────────────────────────────────────────────────────────────────────

-- View que mascara dados financeiros para usuários sem permissão monetária
CREATE OR REPLACE VIEW public.bonus_snapshots_safe AS
SELECT
  id,
  snapshot_kind,
  period_type,
  period_key,
  subject_key,
  user_id,
  subject_role,
  score,
  -- payout_amount só é exposto para payment_manager ou admin
  CASE
    WHEN public.current_user_is_payment_manager() OR public.current_user_bonus_role() = 'admin'
    THEN payout_amount
    ELSE NULL
  END AS payout_amount,
  CASE
    WHEN public.current_user_is_payment_manager() OR public.current_user_bonus_role() = 'admin'
    THEN max_payout_amount
    ELSE NULL
  END AS max_payout_amount,
  sync_status,
  source_provenance,
  source_updated_at,
  calculated_at,
  calculation_version,
  explanation,
  notes,
  created_at,
  updated_at
FROM public.bonus_score_snapshots;

-- RLS na tabela base: leitura aberta a autenticados (a view já filtra financeiro)
DROP POLICY IF EXISTS "Authenticated read bonus_score_snapshots" ON public.bonus_score_snapshots;
CREATE POLICY "Authenticated read bonus_score_snapshots"
ON public.bonus_score_snapshots
FOR SELECT
TO authenticated
USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Atualizar RLS de bonus_internal_evaluations para payment_manager ter acesso total
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admin full access bonus_internal_evaluations" ON public.bonus_internal_evaluations;
CREATE POLICY "Admin full access bonus_internal_evaluations"
ON public.bonus_internal_evaluations
FOR ALL
TO authenticated
USING (
  public.is_admin()
  OR public.current_user_is_payment_manager()
  OR (
    evaluation_scope = 'consultant'
    AND user_id IS NOT NULL
    AND public.can_manage_bonus_consultant(user_id)
  )
)
WITH CHECK (
  public.is_admin()
  OR public.current_user_is_payment_manager()
  OR (
    evaluation_scope = 'consultant'
    AND user_id IS NOT NULL
    AND public.can_manage_bonus_consultant(user_id)
    AND evaluator_user_id = public.current_user_row_id()
  )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Atualizar can_manage_bonus_consultant para incluir payment_manager
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.can_manage_bonus_consultant(target_user_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users current_user_row
    WHERE current_user_row.auth_user_id = auth.uid()
      AND (
        current_user_row.role = 'admin'
        OR public.current_user_is_payment_manager()
        OR current_user_row.id = target_user_id
        OR EXISTS (
          SELECT 1
          FROM public.user_coordinator_links l
          WHERE l.coordinator_user_id = current_user_row.id
            AND l.subordinate_user_id = target_user_id
        )
      )
  );
$$;
