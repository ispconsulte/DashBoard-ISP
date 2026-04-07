
-- =============================================
-- 1. ENABLE RLS ON ALL PUBLIC TABLES
-- =============================================
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colaboradores_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elapsed_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reponsonsibles_tasks_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 2. RLS POLICIES - Authenticated users can read
-- =============================================

-- clientes: authenticated users can read
CREATE POLICY "Authenticated users can read clientes"
  ON public.clientes FOR SELECT
  TO authenticated
  USING (true);

-- colaboradores_cliente: authenticated users can read
CREATE POLICY "Authenticated users can read colaboradores_cliente"
  ON public.colaboradores_cliente FOR SELECT
  TO authenticated
  USING (true);

-- elapsed_times: authenticated users can read
CREATE POLICY "Authenticated users can read elapsed_times"
  ON public.elapsed_times FOR SELECT
  TO authenticated
  USING (true);

-- projects: authenticated users can read
CREATE POLICY "Authenticated users can read projects"
  ON public.projects FOR SELECT
  TO authenticated
  USING (true);

-- reponsonsibles_tasks_users: authenticated users can read
CREATE POLICY "Authenticated users can read reponsonsibles_tasks_users"
  ON public.reponsonsibles_tasks_users FOR SELECT
  TO authenticated
  USING (true);

-- tasks: authenticated users can read
CREATE POLICY "Authenticated users can read tasks"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (true);

-- =============================================
-- 3. FIX VIEW: security_invoker instead of security_definer
-- =============================================
DROP VIEW IF EXISTS public.vw_tempo_detalhado_por_cliente_projeto;

CREATE VIEW public.vw_tempo_detalhado_por_cliente_projeto
WITH (security_invoker = on)
AS
SELECT
  c.cliente_id,
  c.nome AS cliente_nome,
  c."Ativo" AS cliente_ativo,
  c.created_at AS cliente_created_at,
  c.horas_contratadas,
  c.horas_hg_contratadas,
  c.tipo_horas,
  p.id AS projeto_id,
  p.name AS projeto_nome,
  p.active AS projeto_ativo,
  p.closed AS projeto_fechado,
  p.opened AS projeto_aberto,
  p.visible AS projeto_visivel,
  p.project_date_start,
  p.project_date_finish,
  t.task_id,
  t.title AS task_title,
  t.description AS task_description,
  t.status AS task_status,
  t.deadline AS task_deadline,
  t.closed_date AS task_closed_date,
  t.inserted_at AS task_inserted_at,
  t.updated_at AS task_updated_at,
  t.responsible_id,
  t.responsible_name,
  et.id AS elapsed_id,
  et.user_id,
  et.date_start,
  et.date_stop,
  et.minutes,
  et.seconds,
  et.source,
  et.comment_text,
  et.inserted_at AS elapsed_inserted_at,
  et.updated_at AS elapsed_updated_at,
  ROUND((COALESCE(et.seconds, 0))::numeric / 3600.0, 2) AS total_horas,
  ROUND((COALESCE(et.seconds, 0))::numeric / 60.0, 2) AS total_minutos,
  COALESCE(et.seconds, 0) AS total_segundos
FROM public.elapsed_times et
JOIN public.tasks t ON et.task_id = t.task_id
JOIN public.projects p ON t.project_id = p.id
JOIN public.clientes c ON p.cliente_id = c.cliente_id;

-- =============================================
-- 4. FIX MUTABLE SEARCH_PATH ON FUNCTIONS
-- =============================================
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
    AND (filtro_cliente_id IS NULL OR c.cliente_id = filtro_cliente_id)
    AND (filtro_project_id IS NULL OR p.id = filtro_project_id)
  GROUP BY 
    c.cliente_id, c.nome, p.id, p.name
  ORDER BY 
    total_segundos DESC;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_complete_schema()
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
    result jsonb;
BEGIN
    WITH enum_types AS (
        SELECT 
            t.typname as enum_name,
            array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
        GROUP BY t.typname
    )
    SELECT jsonb_build_object(
        'enums',
        COALESCE(jsonb_agg(jsonb_build_object('name', enum_name, 'values', to_jsonb(enum_values))), '[]'::jsonb)
    )
    FROM enum_types
    INTO result;

    WITH RECURSIVE 
    columns_info AS (
        SELECT c.oid as table_oid, c.relname as table_name, a.attname as column_name,
            format_type(a.atttypid, a.atttypmod) as column_type, a.attnotnull as notnull,
            pg_get_expr(d.adbin, d.adrelid) as column_default,
            CASE WHEN a.attidentity != '' THEN true WHEN pg_get_expr(d.adbin, d.adrelid) LIKE 'nextval%' THEN true ELSE false END as is_identity,
            EXISTS (SELECT 1 FROM pg_constraint con WHERE con.conrelid = c.oid AND con.contype = 'p' AND a.attnum = ANY(con.conkey)) as is_pk
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_attribute a ON a.attrelid = c.oid
        LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
    ),
    fk_info AS (
        SELECT c.oid as table_oid, jsonb_agg(jsonb_build_object('name', con.conname, 'column', col.attname, 'foreign_schema', fs.nspname, 'foreign_table', ft.relname, 'foreign_column', fcol.attname, 'on_delete', CASE con.confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'c' THEN 'CASCADE' WHEN 'r' THEN 'RESTRICT' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' ELSE NULL END)) as foreign_keys
        FROM pg_class c JOIN pg_constraint con ON con.conrelid = c.oid JOIN pg_attribute col ON col.attrelid = con.conrelid AND col.attnum = ANY(con.conkey) JOIN pg_class ft ON ft.oid = con.confrelid JOIN pg_namespace fs ON fs.oid = ft.relnamespace JOIN pg_attribute fcol ON fcol.attrelid = con.confrelid AND fcol.attnum = ANY(con.confkey)
        WHERE con.contype = 'f' GROUP BY c.oid
    ),
    index_info AS (
        SELECT c.oid as table_oid, jsonb_agg(jsonb_build_object('name', i.relname, 'using', am.amname, 'columns', (SELECT jsonb_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) FROM unnest(ix.indkey) WITH ORDINALITY as u(attnum, ord) JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = u.attnum))) as indexes
        FROM pg_class c JOIN pg_index ix ON ix.indrelid = c.oid JOIN pg_class i ON i.oid = ix.indexrelid JOIN pg_am am ON am.oid = i.relam WHERE NOT ix.indisprimary GROUP BY c.oid
    ),
    policy_info AS (
        SELECT c.oid as table_oid, jsonb_agg(jsonb_build_object('name', pol.polname, 'command', CASE pol.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE' WHEN '*' THEN 'ALL' END, 'roles', (SELECT string_agg(quote_ident(r.rolname), ', ') FROM pg_roles r WHERE r.oid = ANY(pol.polroles)), 'using', pg_get_expr(pol.polqual, pol.polrelid), 'check', pg_get_expr(pol.polwithcheck, pol.polrelid))) as policies
        FROM pg_class c JOIN pg_policy pol ON pol.polrelid = c.oid GROUP BY c.oid
    ),
    trigger_info AS (
        SELECT c.oid as table_oid, jsonb_agg(jsonb_build_object('name', t.tgname, 'timing', CASE WHEN t.tgtype & 2 = 2 THEN 'BEFORE' WHEN t.tgtype & 4 = 4 THEN 'AFTER' WHEN t.tgtype & 64 = 64 THEN 'INSTEAD OF' END, 'events', (CASE WHEN t.tgtype & 1 = 1 THEN 'INSERT' WHEN t.tgtype & 8 = 8 THEN 'DELETE' WHEN t.tgtype & 16 = 16 THEN 'UPDATE' WHEN t.tgtype & 32 = 32 THEN 'TRUNCATE' END), 'statement', pg_get_triggerdef(t.oid))) as triggers
        FROM pg_class c JOIN pg_trigger t ON t.tgrelid = c.oid WHERE NOT t.tgisinternal GROUP BY c.oid
    ),
    table_info AS (
        SELECT DISTINCT c.table_oid, c.table_name, jsonb_agg(jsonb_build_object('name', c.column_name, 'type', c.column_type, 'notnull', c.notnull, 'default', c.column_default, 'identity', c.is_identity, 'is_pk', c.is_pk) ORDER BY c.column_name) as columns,
            COALESCE(fk.foreign_keys, '[]'::jsonb) as foreign_keys, COALESCE(i.indexes, '[]'::jsonb) as indexes, COALESCE(p.policies, '[]'::jsonb) as policies, COALESCE(t.triggers, '[]'::jsonb) as triggers
        FROM columns_info c LEFT JOIN fk_info fk ON fk.table_oid = c.table_oid LEFT JOIN index_info i ON i.table_oid = c.table_oid LEFT JOIN policy_info p ON p.table_oid = c.table_oid LEFT JOIN trigger_info t ON t.table_oid = c.table_oid
        GROUP BY c.table_oid, c.table_name, fk.foreign_keys, i.indexes, p.policies, t.triggers
    )
    SELECT result || jsonb_build_object('tables', COALESCE(jsonb_agg(jsonb_build_object('name', table_name, 'columns', columns, 'foreign_keys', foreign_keys, 'indexes', indexes, 'policies', policies, 'triggers', triggers)), '[]'::jsonb))
    FROM table_info INTO result;

    WITH function_info AS (
        SELECT p.proname AS name, pg_get_functiondef(p.oid) AS definition
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.prokind = 'f'
    )
    SELECT result || jsonb_build_object('functions', COALESCE(jsonb_agg(jsonb_build_object('name', name, 'definition', definition)), '[]'::jsonb))
    FROM function_info INTO result;

    RETURN result;
END;
$function$;
;
