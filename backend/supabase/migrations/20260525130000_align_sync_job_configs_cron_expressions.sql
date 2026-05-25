-- Align sync_job_configs.cron_expression with the schedules actually registered
-- in pg_cron by schedule_bitrix_sync_jobs(). The UI reads cron_expression from
-- this table, so the display must match what pg_cron executes.
--
-- Real pg_cron schedules registered:
--   Get-Projetcs-And-Tasks-Bitrix -> '0 */4 * * *'  (every 4 h at :00)
--   sync-bitrix-times             -> '20 */4 * * *' (every 4 h at :20)

UPDATE public.sync_job_configs
SET
  cron_expression = '0 */4 * * *',
  updated_at      = now()
WHERE job_name = 'Get-Projetcs-And-Tasks-Bitrix';

UPDATE public.sync_job_configs
SET
  cron_expression = '20 */4 * * *',
  updated_at      = now()
WHERE job_name = 'sync-bitrix-times';
