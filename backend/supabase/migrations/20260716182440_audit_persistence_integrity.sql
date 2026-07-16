-- Evidence gathered before this migration (remote version 20260716182440):
--   * elapsed_times_task_id_fkey was NOT VALID;
--   * 1,402 rows had a non-null task_id and none referenced a missing task;
--   * Supabase's performance advisor reported the FK indexes below as missing.
-- Existing rows with task_id IS NULL are intentionally preserved.

ALTER TABLE public.elapsed_times
  VALIDATE CONSTRAINT elapsed_times_task_id_fkey;

CREATE INDEX IF NOT EXISTS idx_bonus_evaluation_notifications_evaluator_user_id
  ON public.bonus_evaluation_notifications (evaluator_user_id);

CREATE INDEX IF NOT EXISTS idx_bonus_evaluation_reminders_subordinate_user_id
  ON public.bonus_evaluation_reminders (subordinate_user_id);

CREATE INDEX IF NOT EXISTS idx_bonus_internal_evaluations_cliente_id
  ON public.bonus_internal_evaluations (cliente_id);

CREATE INDEX IF NOT EXISTS idx_bonus_internal_evaluations_evaluator_user_id
  ON public.bonus_internal_evaluations (evaluator_user_id);

CREATE INDEX IF NOT EXISTS idx_bonus_internal_evaluations_project_id
  ON public.bonus_internal_evaluations (project_id);

CREATE INDEX IF NOT EXISTS idx_bonus_internal_evaluations_user_id
  ON public.bonus_internal_evaluations (user_id);

CREATE INDEX IF NOT EXISTS idx_bonus_report_emails_consultant_user_id
  ON public.bonus_report_emails (consultant_user_id);

CREATE INDEX IF NOT EXISTS idx_bonus_report_emails_sent_by_user_id
  ON public.bonus_report_emails (sent_by_user_id);

CREATE INDEX IF NOT EXISTS idx_colaboradores_cliente_cliente_id
  ON public.colaboradores_cliente (cliente_id);

CREATE INDEX IF NOT EXISTS idx_projects_cliente_id
  ON public.projects (cliente_id);

CREATE INDEX IF NOT EXISTS idx_user_coordinator_links_subordinate_user_id
  ON public.user_coordinator_links (subordinate_user_id);

CREATE INDEX IF NOT EXISTS idx_users_cliente_id
  ON public.users (cliente_id);

-- Reversal (run only as an explicit rollback):
-- ALTER TABLE public.elapsed_times
--   DROP CONSTRAINT elapsed_times_task_id_fkey;
-- ALTER TABLE public.elapsed_times
--   ADD CONSTRAINT elapsed_times_task_id_fkey
--   FOREIGN KEY (task_id) REFERENCES public.tasks(task_id) NOT VALID;
-- DROP INDEX IF EXISTS public.idx_bonus_evaluation_notifications_evaluator_user_id;
-- DROP INDEX IF EXISTS public.idx_bonus_evaluation_reminders_subordinate_user_id;
-- DROP INDEX IF EXISTS public.idx_bonus_internal_evaluations_cliente_id;
-- DROP INDEX IF EXISTS public.idx_bonus_internal_evaluations_evaluator_user_id;
-- DROP INDEX IF EXISTS public.idx_bonus_internal_evaluations_project_id;
-- DROP INDEX IF EXISTS public.idx_bonus_internal_evaluations_user_id;
-- DROP INDEX IF EXISTS public.idx_bonus_report_emails_consultant_user_id;
-- DROP INDEX IF EXISTS public.idx_bonus_report_emails_sent_by_user_id;
-- DROP INDEX IF EXISTS public.idx_colaboradores_cliente_cliente_id;
-- DROP INDEX IF EXISTS public.idx_projects_cliente_id;
-- DROP INDEX IF EXISTS public.idx_user_coordinator_links_subordinate_user_id;
-- DROP INDEX IF EXISTS public.idx_users_cliente_id;
