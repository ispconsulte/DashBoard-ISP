-- Harden SELECT RLS on bonus tables that previously exposed scores, justifications
-- and payout data via permissive `USING (true)` policies for anon/authenticated.
--
-- Read paths preserved:
--   * bonus_snapshots_safe (SECURITY DEFINER view) remains the public read path and
--     keeps masking payout_amount/max_payout_amount for non-admin / non-payment-manager.
--   * The evaluation modal reads bonus_internal_evaluations directly; the new policy
--     keeps own-row + coordinator + admin + payment-manager visibility.
--
-- INSERT/UPDATE/DELETE behavior is untouched (the "Admin full access ..." ALL policies
-- already gate writes via is_admin() / payment manager / can_manage_bonus_consultant()).

-- ── bonus_internal_evaluations ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Anon read bonus_internal_evaluations" ON public.bonus_internal_evaluations;
DROP POLICY IF EXISTS "Authenticated read bonus_internal_evaluations" ON public.bonus_internal_evaluations;

CREATE POLICY "Authenticated read bonus_internal_evaluations"
  ON public.bonus_internal_evaluations
  FOR SELECT
  TO authenticated
  USING (
    is_admin()
    OR current_user_is_payment_manager()
    OR (user_id IS NOT NULL AND user_id = current_user_row_id())
    OR (user_id IS NOT NULL AND can_manage_bonus_consultant(user_id))
    OR evaluator_user_id = current_user_row_id()
  );

-- ── bonus_score_snapshots ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anon read bonus_score_snapshots" ON public.bonus_score_snapshots;
DROP POLICY IF EXISTS "Authenticated read bonus_score_snapshots" ON public.bonus_score_snapshots;

CREATE POLICY "Authenticated read bonus_score_snapshots"
  ON public.bonus_score_snapshots
  FOR SELECT
  TO authenticated
  USING (
    is_admin()
    OR current_user_is_payment_manager()
    OR (user_id IS NOT NULL AND user_id = current_user_row_id())
    OR (user_id IS NOT NULL AND can_manage_bonus_consultant(user_id))
  );
