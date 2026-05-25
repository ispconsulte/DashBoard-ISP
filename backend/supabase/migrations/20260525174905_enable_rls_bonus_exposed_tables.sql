-- ─────────────────────────────────────────────────────────────────────────────
-- Habilita RLS e cria políticas conservadoras nas tabelas de bonificação que
-- estavam sem proteção. Segue os padrões já estabelecidos em
-- 20260330143000_bonus_sprint_next_version.sql e
-- 20260515145756_bonus_evaluation_notifications.sql.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────
-- 1. user_coordinator_links
-- ─────────────────────────────────────

ALTER TABLE public.user_coordinator_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers read coordinator links" ON public.user_coordinator_links;
CREATE POLICY "Managers read coordinator links"
ON public.user_coordinator_links
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR public.current_user_is_payment_manager()
  OR EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND (
        u.id = coordinator_user_id
        OR u.id = subordinate_user_id
        OR u.role IN ('admin', 'gestor')
      )
  )
);

DROP POLICY IF EXISTS "Admins manage coordinator links" ON public.user_coordinator_links;
CREATE POLICY "Admins manage coordinator links"
ON public.user_coordinator_links
FOR ALL
TO authenticated
USING (
  public.is_admin()
  OR public.current_user_is_payment_manager()
)
WITH CHECK (
  public.is_admin()
  OR public.current_user_is_payment_manager()
);

-- ─────────────────────────────────────
-- 2. bonus_evaluation_reminders
-- ─────────────────────────────────────

ALTER TABLE public.bonus_evaluation_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers read reminder history" ON public.bonus_evaluation_reminders;
CREATE POLICY "Managers read reminder history"
ON public.bonus_evaluation_reminders
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR public.current_user_is_payment_manager()
  OR EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND (
        u.id = coordinator_user_id
        OR u.id = subordinate_user_id
        OR u.role IN ('admin', 'gestor')
      )
  )
);

DROP POLICY IF EXISTS "Admins manage reminder history" ON public.bonus_evaluation_reminders;
CREATE POLICY "Admins manage reminder history"
ON public.bonus_evaluation_reminders
FOR ALL
TO authenticated
USING (
  public.is_admin()
  OR public.current_user_is_payment_manager()
)
WITH CHECK (
  public.is_admin()
  OR public.current_user_is_payment_manager()
);

-- ─────────────────────────────────────
-- 3. bonus_report_emails
-- ─────────────────────────────────────

ALTER TABLE public.bonus_report_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers read report email history" ON public.bonus_report_emails;
CREATE POLICY "Managers read report email history"
ON public.bonus_report_emails
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR public.current_user_is_payment_manager()
  OR EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND (
        u.id = consultant_user_id
        OR u.id = sent_by_user_id
        OR u.role IN ('admin', 'gestor')
      )
  )
);

DROP POLICY IF EXISTS "Admins manage report email history" ON public.bonus_report_emails;
CREATE POLICY "Admins manage report email history"
ON public.bonus_report_emails
FOR ALL
TO authenticated
USING (
  public.is_admin()
  OR public.current_user_is_payment_manager()
)
WITH CHECK (
  public.is_admin()
  OR public.current_user_is_payment_manager()
);;
