-- Add SELECT policy so authenticated users can read client KPIs
DROP POLICY IF EXISTS "Authenticated read client_kpis" ON public.client_kpis;
CREATE POLICY "Authenticated read client_kpis"
ON public.client_kpis
FOR SELECT
TO authenticated
USING (true);
