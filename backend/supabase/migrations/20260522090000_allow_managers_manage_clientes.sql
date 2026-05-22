-- Allow the same management roles that can access the Clientes page to save
-- client records from the authenticated frontend.

DROP POLICY IF EXISTS "Managers manage clientes" ON public.clientes;
CREATE POLICY "Managers manage clientes"
  ON public.clientes
  FOR ALL TO authenticated
  USING (public.is_manager_role())
  WITH CHECK (public.is_manager_role());
