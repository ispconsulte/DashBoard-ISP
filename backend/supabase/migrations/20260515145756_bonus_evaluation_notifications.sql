CREATE TABLE IF NOT EXISTS public.bonus_evaluation_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  evaluator_user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  period_key text NOT NULL,
  period_month integer NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year integer NOT NULL CHECK (period_year >= 2024),
  message text NOT NULL DEFAULT 'Você recebeu uma nova avaliação.',
  read_at timestamptz NULL,
  opened_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, evaluator_user_id, period_key)
);

ALTER TABLE public.bonus_evaluation_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Bonus notification read access" ON public.bonus_evaluation_notifications;
CREATE POLICY "Bonus notification read access"
ON public.bonus_evaluation_notifications
FOR SELECT
TO authenticated
USING (
  user_id = public.current_user_row_id()
  OR evaluator_user_id = public.current_user_row_id()
  OR public.current_user_is_payment_manager()
  OR public.current_user_bonus_role() = 'admin'
);

DROP POLICY IF EXISTS "Bonus evaluators create notifications" ON public.bonus_evaluation_notifications;
CREATE POLICY "Bonus evaluators create notifications"
ON public.bonus_evaluation_notifications
FOR INSERT
TO authenticated
WITH CHECK (
  evaluator_user_id = public.current_user_row_id()
  AND public.can_manage_bonus_consultant(user_id)
);

DROP POLICY IF EXISTS "Bonus notification update access" ON public.bonus_evaluation_notifications;
CREATE POLICY "Bonus notification update access"
ON public.bonus_evaluation_notifications
FOR UPDATE
TO authenticated
USING (
  user_id = public.current_user_row_id()
  OR (
    evaluator_user_id = public.current_user_row_id()
    AND public.can_manage_bonus_consultant(user_id)
  )
  OR public.current_user_is_payment_manager()
  OR public.current_user_bonus_role() = 'admin'
)
WITH CHECK (
  user_id = public.current_user_row_id()
  OR (
    evaluator_user_id = public.current_user_row_id()
    AND public.can_manage_bonus_consultant(user_id)
  )
  OR public.current_user_is_payment_manager()
  OR public.current_user_bonus_role() = 'admin'
);

DROP TRIGGER IF EXISTS update_bonus_evaluation_notifications_updated_at ON public.bonus_evaluation_notifications;
CREATE TRIGGER update_bonus_evaluation_notifications_updated_at
  BEFORE UPDATE ON public.bonus_evaluation_notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
