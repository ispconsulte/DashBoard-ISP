CREATE OR REPLACE VIEW public.operational_elapsed_times AS
SELECT
  et.id,
  et.task_id,
  et.user_id,
  et.comment_text,
  et.date_start,
  et.created_date,
  et.date_stop,
  et.minutes,
  et.seconds,
  et.source,
  et.inserted_at,
  et.updated_at,
  et.bitrix_task_id_raw,
  et.orphan_reason,
  et.orphan_detected_at,
  et.local_state,
  et.orphan_detail,
  et.is_manual_backdated,
  et.reference_date
FROM public.elapsed_times AS et
JOIN public.tasks AS t ON t.task_id = et.task_id
WHERE et.local_state = 'active'
  AND t.local_state = 'active'
  AND NOT (
    t.diagnostic_codes && ARRAY[
      'deleted_confirmed',
      'invalid_project',
      'missing_title',
      'not_found_or_no_access',
      'stale_not_seen'
    ]::text[]
  );

GRANT SELECT ON public.operational_elapsed_times TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_consumo_horas(
  data_inicio timestamptz,
  data_fim timestamptz,
  filtro_cliente_id bigint DEFAULT NULL::bigint,
  filtro_project_id bigint DEFAULT NULL::bigint
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
AS $function$
  SELECT
    c.cliente_id,
    c.nome AS cliente_nome,
    p.id AS projeto_id,
    p.name AS projeto_nome,
    COALESCE(SUM(et.seconds), 0)::bigint AS total_segundos,
    ROUND(COALESCE(SUM(et.seconds), 0) / 3600.0, 2) AS total_horas
  FROM public.elapsed_times AS et
  INNER JOIN public.tasks AS t ON et.task_id = t.task_id
  INNER JOIN public.projects AS p ON t.project_id = p.id
  INNER JOIN public.clientes AS c ON p.cliente_id = c.cliente_id
  WHERE et.reference_date BETWEEN data_inicio AND data_fim
    AND et.local_state = 'active'
    AND t.local_state = 'active'
    AND NOT (
      t.diagnostic_codes && ARRAY[
        'deleted_confirmed',
        'invalid_project',
        'missing_title',
        'not_found_or_no_access',
        'stale_not_seen'
      ]::text[]
    )
    AND (filtro_cliente_id IS NULL OR c.cliente_id = filtro_cliente_id)
    AND (filtro_project_id IS NULL OR p.id = filtro_project_id)
  GROUP BY c.cliente_id, c.nome, p.id, p.name
  ORDER BY total_segundos DESC;
$function$;
