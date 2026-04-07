
CREATE TABLE public.clientes (
  cliente_id bigserial NOT NULL,
  nome text NOT NULL,
  tipo_horas character(2) NOT NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  horas_hg_contratadas double precision NULL,
  "Ativo" boolean NOT NULL DEFAULT true,
  horas_contratadas numeric NOT NULL DEFAULT 0,
  horas_consumidas numeric NOT NULL DEFAULT 0,
  logo_url text NULL,
  cidade text NULL,
  projetos_quantidade integer NOT NULL DEFAULT 0,
  status text NULL,
  CONSTRAINT clientes_pkey PRIMARY KEY (cliente_id),
  CONSTRAINT clientes_status_check CHECK (
    status = ANY (ARRAY['Ativo'::text, 'Inativo'::text, 'Suspenso'::text, 'Cancelado'::text])
  ),
  CONSTRAINT clientes_tipo_horas_check CHECK (
    tipo_horas = ANY (ARRAY['HG'::bpchar, 'HP'::bpchar])
  )
) TABLESPACE pg_default;

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon read clientes" ON public.clientes FOR SELECT TO anon USING (true);
CREATE POLICY "Anon write clientes" ON public.clientes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Admin full access clientes" ON public.clientes FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Authenticated read clientes" ON public.clientes FOR SELECT TO authenticated USING (true);
