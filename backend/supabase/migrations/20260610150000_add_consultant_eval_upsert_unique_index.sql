-- O save de avaliacao do coordenador (BonusEvaluationModal) faz upsert com
-- on_conflict=(period_year,period_month,user_id,evaluator_user_id,category,subtopic).
-- O indice unico existente para isso e PARCIAL (WHERE evaluation_scope='consultant'),
-- e o PostgREST nao consegue casar on_conflict com indice parcial (predicado nao e
-- enviado), retornando HTTP 400. Criamos um indice unico NAO-parcial nas mesmas
-- colunas para o PostgREST conseguir arbitrar o conflito.
--
-- Seguro: apenas o escopo 'consultant' preenche essas 6 colunas; os escopos
-- 'client'/'project' usam seus proprios indices e deixam user_id/category/subtopic
-- nulos, entao nao colidem (NULLs sao distintos em UNIQUE no Postgres).
CREATE UNIQUE INDEX IF NOT EXISTS uq_bonus_internal_evaluations_consultant_upsert
  ON public.bonus_internal_evaluations
  (period_year, period_month, user_id, evaluator_user_id, category, subtopic);
