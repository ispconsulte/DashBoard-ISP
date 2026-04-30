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

UPDATE public.elapsed_times AS et
SET
  orphan_reason = null,
  orphan_detail = null,
  orphan_detected_at = null,
  local_state = 'active',
  updated_at = now()
FROM public.tasks AS t
WHERE et.task_id = t.task_id
  AND et.local_state = 'project_archived'
  AND t.local_state = 'active'
  AND COALESCE(array_length(t.diagnostic_codes, 1), 0) = 0;

UPDATE public.elapsed_times AS et
SET
  orphan_reason = null,
  orphan_detail = null,
  orphan_detected_at = null,
  local_state = 'active',
  updated_at = now()
FROM public.tasks AS t
WHERE et.bitrix_task_id_raw = t.task_id
  AND et.task_id IS NULL
  AND et.local_state = 'project_archived'
  AND t.local_state = 'active'
  AND COALESCE(array_length(t.diagnostic_codes, 1), 0) = 0;
