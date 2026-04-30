ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS diagnostic_codes text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.tasks
DROP CONSTRAINT IF EXISTS tasks_local_state_check;

ALTER TABLE public.tasks
ADD CONSTRAINT tasks_local_state_check
CHECK (local_state IN ('active', 'project_archived', 'deleted_confirmed', 'not_found_or_no_access', 'stale_not_seen'));

CREATE INDEX IF NOT EXISTS idx_tasks_diagnostic_codes_gin
  ON public.tasks USING gin (diagnostic_codes);

CREATE INDEX IF NOT EXISTS idx_tasks_operational_state
  ON public.tasks (local_state, project_id, responsible_id, deadline);

CREATE INDEX IF NOT EXISTS idx_tasks_project_id
  ON public.tasks (project_id);

CREATE INDEX IF NOT EXISTS idx_tasks_responsible_id
  ON public.tasks (responsible_id);

CREATE INDEX IF NOT EXISTS idx_tasks_deadline
  ON public.tasks (deadline);

ALTER TABLE public.elapsed_times
DROP CONSTRAINT IF EXISTS elapsed_times_local_state_check;

ALTER TABLE public.elapsed_times
ADD CONSTRAINT elapsed_times_local_state_check
CHECK (local_state IN ('active', 'deleted_confirmed', 'project_archived', 'not_found_or_no_access', 'orphan_time_entry', 'task_integrity_blocked'));

CREATE OR REPLACE FUNCTION public.calculate_task_diagnostic_codes(
  task_title text,
  task_project_id bigint,
  project_exists boolean,
  project_closed boolean,
  project_name text,
  task_group_name text,
  task_responsible_id bigint,
  task_responsible_name text,
  task_deadline timestamptz,
  task_local_state text
)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(code ORDER BY code), '{}'::text[])
  FROM (
    SELECT DISTINCT code
    FROM unnest(ARRAY[
      CASE WHEN task_project_id IS NULL THEN 'missing_project' END,
      CASE WHEN task_project_id IS NOT NULL AND project_exists IS FALSE THEN 'invalid_project' END,
      CASE WHEN COALESCE(project_closed, false) THEN 'project_archived' END,
      CASE WHEN task_local_state = 'project_archived' THEN 'project_archived' END,
      CASE WHEN task_local_state = 'deleted_confirmed' THEN 'deleted_confirmed' END,
      CASE WHEN task_local_state = 'not_found_or_no_access' THEN 'not_found_or_no_access' END,
      CASE WHEN task_local_state = 'stale_not_seen' THEN 'stale_not_seen' END,
      CASE WHEN NULLIF(BTRIM(COALESCE(task_title, '')), '') IS NULL THEN 'missing_title' END,
      CASE WHEN task_responsible_id IS NULL AND NULLIF(BTRIM(COALESCE(task_responsible_name, '')), '') IS NULL THEN 'missing_responsible' END,
      CASE WHEN task_deadline IS NULL THEN 'missing_deadline' END,
      CASE
        WHEN lower(BTRIM(COALESCE(project_name, task_group_name, ''))) IN ('sp', 'sp consulte', 'isp', 'isp consulte', 'interno', 'internal')
        THEN 'internal_project'
      END
    ]) AS diagnostic(code)
    WHERE code IS NOT NULL
  ) AS codes;
$$;

CREATE OR REPLACE FUNCTION public.reclassify_task_integrity()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer := 0;
  counts jsonb := '{}'::jsonb;
BEGIN
  WITH classified AS (
    SELECT
      t.task_id,
      COALESCE(p.closed, false) AS next_project_closed,
      CASE
        WHEN t.local_state IN ('deleted_confirmed', 'not_found_or_no_access', 'stale_not_seen') THEN t.local_state
        WHEN COALESCE(p.closed, false) THEN 'project_archived'
        ELSE 'active'
      END AS next_local_state,
      public.calculate_task_diagnostic_codes(
        t.title,
        t.project_id,
        CASE WHEN t.project_id IS NULL THEN true ELSE p.id IS NOT NULL END,
        COALESCE(p.closed, false),
        p.name,
        t.group_name,
        t.responsible_id,
        t.responsible_name,
        t.deadline,
        CASE
          WHEN t.local_state IN ('deleted_confirmed', 'not_found_or_no_access', 'stale_not_seen') THEN t.local_state
          WHEN COALESCE(p.closed, false) THEN 'project_archived'
          ELSE 'active'
        END
      ) AS next_diagnostic_codes
    FROM public.tasks AS t
    LEFT JOIN public.projects AS p ON p.id = t.project_id
  ),
  updated AS (
    UPDATE public.tasks AS t
    SET
      project_closed = c.next_project_closed,
      local_state = c.next_local_state,
      diagnostic_codes = c.next_diagnostic_codes,
      updated_at = now()
    FROM classified AS c
    WHERE t.task_id = c.task_id
      AND (
        t.project_closed IS DISTINCT FROM c.next_project_closed
        OR t.local_state IS DISTINCT FROM c.next_local_state
        OR t.diagnostic_codes IS DISTINCT FROM c.next_diagnostic_codes
      )
    RETURNING t.task_id
  )
  SELECT COUNT(*) INTO updated_count FROM updated;

  SELECT COALESCE(jsonb_object_agg(code, task_count), '{}'::jsonb)
  INTO counts
  FROM (
    SELECT code, COUNT(*)::bigint AS task_count
    FROM public.tasks AS t
    CROSS JOIN LATERAL unnest(t.diagnostic_codes) AS diagnostic(code)
    GROUP BY code
    ORDER BY code
  ) AS diagnostic_counts;

  RETURN jsonb_build_object(
    'updated_tasks', updated_count,
    'diagnostic_counts', counts,
    'operational_tasks', (
      SELECT COUNT(*) FROM public.tasks
      WHERE local_state = 'active'
        AND COALESCE(array_length(diagnostic_codes, 1), 0) = 0
    ),
    'integrity_tasks', (
      SELECT COUNT(*) FROM public.tasks
      WHERE local_state <> 'active'
         OR COALESCE(array_length(diagnostic_codes, 1), 0) > 0
    )
  );
END;
$$;

SELECT public.reclassify_task_integrity();

CREATE OR REPLACE VIEW public.operational_tasks
WITH (security_invoker = true) AS
SELECT t.*
FROM public.tasks AS t
WHERE t.local_state = 'active'
  AND COALESCE(array_length(t.diagnostic_codes, 1), 0) = 0;

CREATE OR REPLACE VIEW public.integrity_tasks
WITH (security_invoker = true) AS
SELECT t.*
FROM public.tasks AS t
WHERE t.local_state <> 'active'
   OR COALESCE(array_length(t.diagnostic_codes, 1), 0) > 0;

CREATE OR REPLACE VIEW public.operational_elapsed_times
WITH (security_invoker = true) AS
SELECT et.*
FROM public.elapsed_times AS et
INNER JOIN public.tasks AS t ON t.task_id = et.task_id
WHERE et.local_state = 'active'
  AND t.local_state = 'active'
  AND COALESCE(array_length(t.diagnostic_codes, 1), 0) = 0;

CREATE OR REPLACE VIEW public.task_integrity_diagnostic_counts
WITH (security_invoker = true) AS
SELECT code AS diagnostic_code, COUNT(*)::bigint AS task_count
FROM public.tasks AS t
CROSS JOIN LATERAL unnest(t.diagnostic_codes) AS diagnostic(code)
GROUP BY code;

CREATE OR REPLACE VIEW public.task_integrity_backfill_summary
WITH (security_invoker = true) AS
SELECT
  code AS diagnostic_code,
  COUNT(*)::bigint AS task_count
FROM public.tasks AS t
CROSS JOIN LATERAL unnest(t.diagnostic_codes) AS diagnostic(code)
GROUP BY code;

GRANT SELECT ON public.operational_tasks TO anon, authenticated;
GRANT SELECT ON public.integrity_tasks TO authenticated;
GRANT SELECT ON public.operational_elapsed_times TO anon, authenticated;
GRANT SELECT ON public.task_integrity_diagnostic_counts TO authenticated;
GRANT SELECT ON public.task_integrity_backfill_summary TO authenticated;

CREATE OR REPLACE FUNCTION public.get_consumo_horas(
  data_inicio timestamptz,
  data_fim timestamptz,
  filtro_cliente_id bigint DEFAULT NULL,
  filtro_project_id bigint DEFAULT NULL
)
RETURNS TABLE(
  cliente_id bigint,
  cliente_nome text,
  projeto_id bigint,
  projeto_nome text,
  total_segundos bigint,
  total_horas numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    c.cliente_id,
    c.nome as cliente_nome,
    p.id as projeto_id,
    p.name as projeto_nome,
    COALESCE(SUM(et.seconds), 0)::bigint as total_segundos,
    ROUND(COALESCE(SUM(et.seconds), 0) / 3600.0, 2) as total_horas
  FROM
    public.elapsed_times et
    INNER JOIN public.tasks t ON et.task_id = t.task_id
    INNER JOIN public.projects p ON t.project_id = p.id
    INNER JOIN public.clientes c ON p.cliente_id = c.cliente_id
  WHERE
    et.created_date BETWEEN data_inicio AND data_fim
    AND et.local_state = 'active'
    AND t.local_state = 'active'
    AND COALESCE(array_length(t.diagnostic_codes, 1), 0) = 0
    AND (filtro_cliente_id IS NULL OR c.cliente_id = filtro_cliente_id)
    AND (filtro_project_id IS NULL OR p.id = filtro_project_id)
  GROUP BY
    c.cliente_id, c.nome, p.id, p.name
  ORDER BY
    total_segundos DESC;
$$;

CREATE OR REPLACE FUNCTION public.relink_elapsed_times_to_tasks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_count integer := 0;
BEGIN
  PERFORM public.reclassify_task_integrity();

  UPDATE public.elapsed_times et
  SET
    task_id = t.task_id,
    orphan_reason = CASE
      WHEN t.local_state = 'active' AND COALESCE(array_length(t.diagnostic_codes, 1), 0) = 0 THEN null
      WHEN t.local_state <> 'active' THEN t.local_state
      ELSE 'task_integrity_blocked'
    END,
    orphan_detail = CASE
      WHEN t.local_state = 'active' AND COALESCE(array_length(t.diagnostic_codes, 1), 0) = 0 THEN null
      WHEN t.local_state <> 'active' THEN 'A hora esta ligada a uma tarefa fora do estado operacional.'
      ELSE 'A hora esta ligada a uma tarefa bloqueada na Central de Integridade.'
    END,
    orphan_detected_at = CASE
      WHEN t.local_state = 'active' AND COALESCE(array_length(t.diagnostic_codes, 1), 0) = 0 THEN null
      ELSE COALESCE(et.orphan_detected_at, now())
    END,
    local_state = CASE
      WHEN t.local_state = 'active' AND COALESCE(array_length(t.diagnostic_codes, 1), 0) = 0 THEN 'active'
      WHEN t.local_state IN ('project_archived', 'deleted_confirmed', 'not_found_or_no_access') THEN t.local_state
      ELSE 'task_integrity_blocked'
    END,
    bitrix_task_id_raw = COALESCE(et.bitrix_task_id_raw, t.task_id),
    updated_at = now()
  FROM public.tasks t
  WHERE (et.task_id = t.task_id OR (et.task_id IS NULL AND et.bitrix_task_id_raw = t.task_id));

  GET DIAGNOSTICS affected_count = ROW_COUNT;

  UPDATE public.elapsed_times
  SET
    bitrix_task_id_raw = task_id,
    updated_at = now()
  WHERE bitrix_task_id_raw IS NULL
    AND task_id IS NOT NULL;

  RETURN affected_count;
END;
$$;
