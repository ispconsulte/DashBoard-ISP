-- Remove políticas que permitiam ESCRITA por anon (anônimo) sem restrição.
-- Risco corrigido: qualquer um com a chave pública (exposta no frontend) podia
-- INSERT/UPDATE/DELETE nessas tabelas — incluindo alterar QUALQUER linha de `users`.
--
-- Verificado antes de aplicar: o frontend SÓ LÊ (.select) essas tabelas; as escritas
-- reais vêm de edge functions com service_role (que ignoram RLS). As policies de
-- SELECT anon são PRESERVADAS, então a leitura pública continua funcionando.
--
-- Detectado por: Supabase advisor `rls_policy_always_true` (lint 0024).

DROP POLICY IF EXISTS "Anon update users" ON public.users;
DROP POLICY IF EXISTS "Anon write client_kpis" ON public.client_kpis;
DROP POLICY IF EXISTS "Anon write client_benchmarks" ON public.client_benchmarks;
DROP POLICY IF EXISTS "Anon write project_financials" ON public.project_financials;
DROP POLICY IF EXISTS "Anon write project_contracted_hours" ON public.project_contracted_hours;
DROP POLICY IF EXISTS "Anon write health_score_config" ON public.health_score_config;
DROP POLICY IF EXISTS "Anon write user_capacity" ON public.user_capacity;

-- =====================================================================
-- ROLLBACK (recriar as policies originais caso necessário):
-- =====================================================================
-- CREATE POLICY "Anon update users" ON public.users FOR UPDATE TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY "Anon write client_kpis" ON public.client_kpis FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY "Anon write client_benchmarks" ON public.client_benchmarks FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY "Anon write project_financials" ON public.project_financials FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY "Anon write project_contracted_hours" ON public.project_contracted_hours FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY "Anon write health_score_config" ON public.health_score_config FOR ALL TO anon USING (true) WITH CHECK (true);
-- CREATE POLICY "Anon write user_capacity" ON public.user_capacity FOR ALL TO anon USING (true) WITH CHECK (true);
