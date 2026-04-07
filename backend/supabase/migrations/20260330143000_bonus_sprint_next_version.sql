ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS seniority text
    CHECK (seniority IN ('junior', 'pleno', 'senior')),
  ADD COLUMN IF NOT EXISTS role text
    CHECK (role IN ('admin', 'gestor', 'consultor'))
    DEFAULT 'consultor',
  ADD COLUMN IF NOT EXISTS bitrix_user_id text;

UPDATE public.users
SET seniority = lower(trim(seniority_level))
WHERE seniority IS NULL
  AND seniority_level IS NOT NULL
  AND lower(trim(seniority_level)) IN ('junior', 'pleno', 'senior');

UPDATE public.users
SET role = CASE
  WHEN lower(trim(coalesce(user_profile, ''))) IN ('administrador', 'admin') THEN 'admin'
  WHEN lower(trim(coalesce(user_profile, ''))) IN ('gerente', 'coordenador', 'gestor') THEN 'gestor'
  ELSE 'consultor'
END
WHERE role IS NULL;

CREATE TABLE IF NOT EXISTS public.user_coordinator_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coordinator_user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subordinate_user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(coordinator_user_id, subordinate_user_id),
  CONSTRAINT user_coordinator_links_no_self CHECK (coordinator_user_id <> subordinate_user_id)
);

ALTER TABLE public.user_coordinator_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers read coordinator links" ON public.user_coordinator_links;
CREATE POLICY "Managers read coordinator links"
ON public.user_coordinator_links
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.users current_user_row
    WHERE current_user_row.auth_user_id = auth.uid()
      AND (
        current_user_row.id = coordinator_user_id
        OR current_user_row.id = subordinate_user_id
        OR current_user_row.role IN ('admin', 'gestor')
      )
  )
);

DROP POLICY IF EXISTS "Admins manage coordinator links" ON public.user_coordinator_links;
CREATE POLICY "Admins manage coordinator links"
ON public.user_coordinator_links
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

ALTER TABLE public.bonus_internal_evaluations
  ADD COLUMN IF NOT EXISTS period_month integer,
  ADD COLUMN IF NOT EXISTS period_year integer,
  ADD COLUMN IF NOT EXISTS category text
    CHECK (category IN ('hard_skill_manual', 'soft_skill', 'people_skill')),
  ADD COLUMN IF NOT EXISTS subtopic text,
  ADD COLUMN IF NOT EXISTS score_1_10 numeric(4,2),
  ADD COLUMN IF NOT EXISTS justificativa text,
  ADD COLUMN IF NOT EXISTS pontos_de_melhoria text,
  ADD COLUMN IF NOT EXISTS status text
    CHECK (status IN ('draft', 'submitted'))
    DEFAULT 'draft';

ALTER TABLE public.bonus_internal_evaluations
  DROP CONSTRAINT IF EXISTS bonus_internal_evaluations_payload_chk;

ALTER TABLE public.bonus_internal_evaluations
  ADD CONSTRAINT bonus_internal_evaluations_payload_chk
  CHECK (
    soft_skill_score IS NOT NULL
    OR people_skill_score IS NOT NULL
    OR nps_score IS NOT NULL
    OR score_1_10 IS NOT NULL
  );

UPDATE public.bonus_internal_evaluations
SET period_month = split_part(period_key, '-', 2)::integer
WHERE period_month IS NULL
  AND period_key ~ '^\d{4}-\d{2}$';

UPDATE public.bonus_internal_evaluations
SET period_year = split_part(period_key, '-', 1)::integer
WHERE period_year IS NULL
  AND period_key ~ '^\d{4}-\d{2}$';

DROP INDEX IF EXISTS public.idx_bonus_internal_evaluations_consultant_period;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bonus_internal_evaluations_consultant_subtopic_period
  ON public.bonus_internal_evaluations (
    period_year,
    period_month,
    user_id,
    evaluator_user_id,
    category,
    subtopic
  )
  WHERE evaluation_scope = 'consultant';

CREATE TABLE IF NOT EXISTS public.bonus_evaluation_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coordinator_user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subordinate_user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  period_month integer NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year integer NOT NULL CHECK (period_year >= 2024),
  bitrix_task_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(coordinator_user_id, subordinate_user_id, period_month, period_year)
);

ALTER TABLE public.bonus_evaluation_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers read reminder history" ON public.bonus_evaluation_reminders;
CREATE POLICY "Managers read reminder history"
ON public.bonus_evaluation_reminders
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.users current_user_row
    WHERE current_user_row.auth_user_id = auth.uid()
      AND (
        current_user_row.id = coordinator_user_id
        OR current_user_row.id = subordinate_user_id
        OR current_user_row.role IN ('admin', 'gestor')
      )
  )
);

DROP POLICY IF EXISTS "Admins manage reminder history" ON public.bonus_evaluation_reminders;
CREATE POLICY "Admins manage reminder history"
ON public.bonus_evaluation_reminders
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.bonus_report_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sent_by_user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  period_month integer NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year integer NOT NULL CHECK (period_year >= 2024),
  recipient_email text NOT NULL,
  coordinator_message text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bonus_report_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers read report email history" ON public.bonus_report_emails;
CREATE POLICY "Managers read report email history"
ON public.bonus_report_emails
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.users current_user_row
    WHERE current_user_row.auth_user_id = auth.uid()
      AND (
        current_user_row.id = consultant_user_id
        OR current_user_row.id = sent_by_user_id
        OR current_user_row.role IN ('admin', 'gestor')
      )
  )
);

DROP POLICY IF EXISTS "Admins manage report email history" ON public.bonus_report_emails;
CREATE POLICY "Admins manage report email history"
ON public.bonus_report_emails
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.current_user_bonus_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (
      SELECT u.role
      FROM public.users u
      WHERE u.auth_user_id = auth.uid()
      LIMIT 1
    ),
    'consultor'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_row_id()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id
  FROM public.users u
  WHERE u.auth_user_id = auth.uid()
  LIMIT 1;
$$;

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

DROP POLICY IF EXISTS "Admin full access bonus_internal_evaluations" ON public.bonus_internal_evaluations;
CREATE POLICY "Admin full access bonus_internal_evaluations"
  ON public.bonus_internal_evaluations
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR (
      evaluation_scope = 'consultant'
      AND user_id IS NOT NULL
      AND public.can_manage_bonus_consultant(user_id)
    )
  )
  WITH CHECK (
    public.is_admin()
    OR (
      evaluation_scope = 'consultant'
      AND user_id IS NOT NULL
      AND public.can_manage_bonus_consultant(user_id)
      AND evaluator_user_id = public.current_user_row_id()
    )
  );

CREATE OR REPLACE FUNCTION public.schedule_bonus_reminder_job(
  p_project_url text,
  p_service_role_key text,
  p_cron text DEFAULT '0 12 1 * *'
)
RETURNS TABLE(scheduled_job_name text, scheduled_cron_expression text, scheduled_job_id bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reminder_job_id bigint;
  normalized_url text;
BEGIN
  IF coalesce(trim(p_project_url), '') = '' THEN
    RAISE EXCEPTION 'project_url is required';
  END IF;

  IF coalesce(trim(p_service_role_key), '') = '' THEN
    RAISE EXCEPTION 'service_role_key is required';
  END IF;

  normalized_url := rtrim(trim(p_project_url), '/');

  PERFORM public.unschedule_sync_job('create-monthly-reminders');

  reminder_job_id := cron.schedule(
    'create-monthly-reminders',
    p_cron,
    format(
      $job$
      select net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := %L::jsonb
      ) as request_id;
      $job$,
      normalized_url || '/functions/v1/create-monthly-reminders',
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || p_service_role_key,
        'apikey', p_service_role_key
      )::text,
      '{}'::jsonb::text
    )
  );

  INSERT INTO public.sync_job_configs (
    job_name,
    cron_expression,
    endpoint_path,
    enabled,
    request_body,
    last_scheduled_at,
    last_job_id
  )
  VALUES (
    'create-monthly-reminders',
    p_cron,
    '/functions/v1/create-monthly-reminders',
    true,
    '{}'::jsonb,
    now(),
    reminder_job_id
  )
  ON CONFLICT (job_name) DO UPDATE SET
    cron_expression = EXCLUDED.cron_expression,
    endpoint_path = EXCLUDED.endpoint_path,
    enabled = EXCLUDED.enabled,
    request_body = EXCLUDED.request_body,
    last_scheduled_at = EXCLUDED.last_scheduled_at,
    last_job_id = EXCLUDED.last_job_id,
    updated_at = now();

  RETURN QUERY
  SELECT 'create-monthly-reminders'::text, p_cron, reminder_job_id;
END;
$$;
