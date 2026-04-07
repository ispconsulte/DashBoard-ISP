
-- 1. Create user_client_access mapping table
CREATE TABLE IF NOT EXISTS public.user_client_access (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  cliente_id bigint NOT NULL REFERENCES public.clientes(cliente_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, cliente_id)
);

-- 2. Enable RLS on the new table
ALTER TABLE public.user_client_access ENABLE ROW LEVEL SECURITY;

-- 3. Policies for user_client_access
CREATE POLICY "Admin full access user_client_access"
  ON public.user_client_access FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Users read own client access"
  ON public.user_client_access FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 4. Replace the broad clientes SELECT policy
DROP POLICY IF EXISTS "Authenticated read clientes" ON public.clientes;

CREATE POLICY "Authenticated read clientes"
  ON public.clientes FOR SELECT TO authenticated
  USING (
    is_admin() OR EXISTS (
      SELECT 1 FROM public.user_client_access uca
      WHERE uca.cliente_id = clientes.cliente_id
        AND uca.user_id = auth.uid()
    )
  );
