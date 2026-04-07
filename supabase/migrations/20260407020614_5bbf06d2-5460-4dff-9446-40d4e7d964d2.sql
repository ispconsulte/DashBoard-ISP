
CREATE POLICY "Authenticated read clientes"
  ON public.clientes FOR SELECT TO authenticated
  USING (true);
