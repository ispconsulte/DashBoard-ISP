CREATE OR REPLACE VIEW public.operational_tasks
WITH (security_invoker = true) AS
SELECT t.*
FROM public.tasks AS t
WHERE t.local_state = 'active'
  AND COALESCE(array_length(t.diagnostic_codes, 1), 0) = 0;

GRANT SELECT ON public.operational_tasks TO anon, authenticated;
