
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS time_spent_in_logs integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.tasks.time_spent_in_logs IS
  'Tempo total gasto na tarefa (segundos), campo TIME_SPENT_IN_LOGS do Bitrix. Usado para bater com o relatorio Horas Trabalhadas do Bitrix.';
;
