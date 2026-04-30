REVOKE EXECUTE ON FUNCTION public.reclassify_task_integrity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.relink_elapsed_times_to_tasks() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reclassify_task_integrity() TO service_role;
GRANT EXECUTE ON FUNCTION public.relink_elapsed_times_to_tasks() TO service_role;
