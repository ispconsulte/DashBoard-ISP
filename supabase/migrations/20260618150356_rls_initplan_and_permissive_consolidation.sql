-- Migration: RLS initplan fix + duplicated permissive SELECT policy consolidation
-- Scope: RLS policies only. No tables/columns/indexes/FKs/triggers/functions touched.
-- Strategy:
--   1. auth_rls_initplan: wrap direct auth.uid()/auth.role() in (select ...) so the
--      planner evaluates them once (initplan) instead of per-row. Stable helper
--      functions (is_admin(), has_role(), is_manager_role(), current_user_*()) are
--      already initplan-safe and are LEFT UNCHANGED.
--   2. multiple_permissive_policies: drop exact-duplicate permissive SELECT policies
--      (same table/cmd/role-coverage/qual) keeping one equivalent policy.
-- Every change preserves access behavior exactly. Rollback block at the bottom
-- restores the original definitions 1:1.
--
-- NOTE: overly permissive `anon` write policies are intentionally NOT modified here
-- (out of approved scope) — see TODO markers.

-- =====================================================================
-- VALIDATION HELPERS (run manually; not executed as part of the migration)
-- =====================================================================
-- Snapshot BEFORE applying:
--   CREATE TEMP TABLE _pol_before AS
--     SELECT schemaname, tablename, policyname, cmd, roles, permissive, qual, with_check
--     FROM pg_policies WHERE schemaname = 'public';
-- Snapshot AFTER applying + diff (should only show the consolidated drops and the
-- rewritten qual/with_check, never a change in effective role/cmd coverage):
--   SELECT * FROM _pol_before
--   EXCEPT SELECT schemaname, tablename, policyname, cmd, roles, permissive, qual, with_check
--          FROM pg_policies WHERE schemaname = 'public';
-- Confirm advisors cleared afterwards via Supabase advisors (performance).

BEGIN;

-- =====================================================================
-- 1. INITPLAN FIXES (auth.uid() / auth.role() -> (select ...))
-- =====================================================================

-- ---- audit_log -------------------------------------------------------
DROP POLICY IF EXISTS "service_role_audit" ON public.audit_log;
CREATE POLICY "service_role_audit" ON public.audit_log
  AS PERMISSIVE FOR ALL TO public
  USING ((select auth.role()) = 'service_role'::text)
  WITH CHECK ((select auth.role()) = 'service_role'::text);

DROP POLICY IF EXISTS "admins_insert_audit" ON public.audit_log;
CREATE POLICY "admins_insert_audit" ON public.audit_log
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Admin read audit" ON public.audit_log;
CREATE POLICY "Admin read audit" ON public.audit_log
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (EXISTS ( SELECT 1
     FROM user_roles
    WHERE ((user_roles.user_id = (select auth.uid())) AND (user_roles.role = 'admin'::app_role))));

DROP POLICY IF EXISTS "admins_read_audit" ON public.audit_log;
CREATE POLICY "admins_read_audit" ON public.audit_log
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role));

-- ---- reponsonsibles_tasks_users -------------------------------------
DROP POLICY IF EXISTS "Users can read own record in reponsonsibles_tasks_users" ON public.reponsonsibles_tasks_users;
CREATE POLICY "Users can read own record in reponsonsibles_tasks_users" ON public.reponsonsibles_tasks_users
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((select auth.uid()) = auth_user_id);

-- ---- project_contracted_hours (admin write paths via user_roles) ----
DROP POLICY IF EXISTS "Admins can delete contracted hours" ON public.project_contracted_hours;
CREATE POLICY "Admins can delete contracted hours" ON public.project_contracted_hours
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (EXISTS ( SELECT 1
     FROM user_roles
    WHERE ((user_roles.user_id = (select auth.uid())) AND (user_roles.role = 'admin'::app_role))));

DROP POLICY IF EXISTS "Admins can insert contracted hours" ON public.project_contracted_hours;
CREATE POLICY "Admins can insert contracted hours" ON public.project_contracted_hours
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS ( SELECT 1
     FROM user_roles
    WHERE ((user_roles.user_id = (select auth.uid())) AND (user_roles.role = 'admin'::app_role))));

DROP POLICY IF EXISTS "Admins can update contracted hours" ON public.project_contracted_hours;
CREATE POLICY "Admins can update contracted hours" ON public.project_contracted_hours
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (EXISTS ( SELECT 1
     FROM user_roles
    WHERE ((user_roles.user_id = (select auth.uid())) AND (user_roles.role = 'admin'::app_role))));

-- ---- user_allowed_areas ---------------------------------------------
DROP POLICY IF EXISTS "admins_manage_areas" ON public.user_allowed_areas;
CREATE POLICY "admins_manage_areas" ON public.user_allowed_areas
  AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "service_role_uaa" ON public.user_allowed_areas;
CREATE POLICY "service_role_uaa" ON public.user_allowed_areas
  AS PERMISSIVE FOR ALL TO public
  USING ((select auth.role()) = 'service_role'::text)
  WITH CHECK ((select auth.role()) = 'service_role'::text);

DROP POLICY IF EXISTS "users_see_own_areas" ON public.user_allowed_areas;
CREATE POLICY "users_see_own_areas" ON public.user_allowed_areas
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- ---- user_capacity ---------------------------------------------------
DROP POLICY IF EXISTS "Users read own capacity" ON public.user_capacity;
CREATE POLICY "Users read own capacity" ON public.user_capacity
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- ---- user_project_access --------------------------------------------
DROP POLICY IF EXISTS "admins_manage_project_access" ON public.user_project_access;
CREATE POLICY "admins_manage_project_access" ON public.user_project_access
  AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "service_role_upa" ON public.user_project_access;
CREATE POLICY "service_role_upa" ON public.user_project_access
  AS PERMISSIVE FOR ALL TO public
  USING ((select auth.role()) = 'service_role'::text)
  WITH CHECK ((select auth.role()) = 'service_role'::text);

DROP POLICY IF EXISTS "users_see_own_project_access" ON public.user_project_access;
CREATE POLICY "users_see_own_project_access" ON public.user_project_access
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- ---- user_roles ------------------------------------------------------
DROP POLICY IF EXISTS "admins_manage_roles" ON public.user_roles;
CREATE POLICY "admins_manage_roles" ON public.user_roles
  AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "service_role_roles" ON public.user_roles;
CREATE POLICY "service_role_roles" ON public.user_roles
  AS PERMISSIVE FOR ALL TO public
  USING ((select auth.role()) = 'service_role'::text)
  WITH CHECK ((select auth.role()) = 'service_role'::text);

DROP POLICY IF EXISTS "users_see_own_role" ON public.user_roles;
CREATE POLICY "users_see_own_role" ON public.user_roles
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- ---- users -----------------------------------------------------------
DROP POLICY IF EXISTS "admins_full_access" ON public.users;
CREATE POLICY "admins_full_access" ON public.users
  AS PERMISSIVE FOR ALL TO authenticated
  USING (has_role((select auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((select auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
CREATE POLICY "Admins can view all users" ON public.users
  AS PERMISSIVE FOR SELECT TO public
  USING (is_admin_user() OR (auth_user_id = (select auth.uid())));

DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own" ON public.users
  AS PERMISSIVE FOR SELECT TO public
  USING ((select auth.uid()) = auth_user_id);

DROP POLICY IF EXISTS "Users can update own or admin all" ON public.users;
CREATE POLICY "Users can update own or admin all" ON public.users
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth_user_id = (select auth.uid())) OR is_admin())
  WITH CHECK (
    CASE
        WHEN is_admin() THEN true
        ELSE ((auth_user_id = (select auth.uid())) AND (auth_user_id = (select auth.uid())) AND (active = true))
    END);

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users
  AS PERMISSIVE FOR UPDATE TO public
  USING ((select auth.uid()) = auth_user_id)
  WITH CHECK ((select auth.uid()) = auth_user_id);
-- TODO(out-of-scope): "Anon update users" (anon, qual=true) is overly permissive; left unchanged.

-- ---- bonus_evaluation_reminders (EXISTS u.auth_user_id = auth.uid()) -
DROP POLICY IF EXISTS "Managers read reminder history" ON public.bonus_evaluation_reminders;
CREATE POLICY "Managers read reminder history" ON public.bonus_evaluation_reminders
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_admin() OR current_user_is_payment_manager() OR (EXISTS ( SELECT 1
     FROM users u
    WHERE ((u.auth_user_id = (select auth.uid())) AND ((u.id = bonus_evaluation_reminders.coordinator_user_id) OR (u.id = bonus_evaluation_reminders.subordinate_user_id) OR (u.role = ANY (ARRAY['admin'::text, 'gestor'::text])))))));

-- ---- bonus_report_emails --------------------------------------------
DROP POLICY IF EXISTS "Managers read report email history" ON public.bonus_report_emails;
CREATE POLICY "Managers read report email history" ON public.bonus_report_emails
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_admin() OR current_user_is_payment_manager() OR (EXISTS ( SELECT 1
     FROM users u
    WHERE ((u.auth_user_id = (select auth.uid())) AND ((u.id = bonus_report_emails.consultant_user_id) OR (u.id = bonus_report_emails.sent_by_user_id) OR (u.role = ANY (ARRAY['admin'::text, 'gestor'::text])))))));

-- ---- user_coordinator_links -----------------------------------------
DROP POLICY IF EXISTS "Managers read coordinator links" ON public.user_coordinator_links;
CREATE POLICY "Managers read coordinator links" ON public.user_coordinator_links
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_admin() OR current_user_is_payment_manager() OR (EXISTS ( SELECT 1
     FROM users u
    WHERE ((u.auth_user_id = (select auth.uid())) AND ((u.id = user_coordinator_links.coordinator_user_id) OR (u.id = user_coordinator_links.subordinate_user_id) OR (u.role = ANY (ARRAY['admin'::text, 'gestor'::text])))))));

-- =====================================================================
-- 2. CONSOLIDATE DUPLICATED PERMISSIVE SELECT POLICIES
--    (drop exact duplicates; keep one with equivalent role/cmd/qual coverage)
-- =====================================================================

-- ---- bonus_metric_breakdowns: SELECT anon(true) + authenticated(true) -> one for {anon,authenticated}
DROP POLICY IF EXISTS "Anon read bonus_metric_breakdowns" ON public.bonus_metric_breakdowns;
DROP POLICY IF EXISTS "Authenticated read bonus_metric_breakdowns" ON public.bonus_metric_breakdowns;
CREATE POLICY "Public read bonus_metric_breakdowns" ON public.bonus_metric_breakdowns
  AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (true);

-- ---- bonus_source_statuses: SELECT anon(true) + authenticated(true) -> one for {anon,authenticated}
DROP POLICY IF EXISTS "Anon read bonus_source_statuses" ON public.bonus_source_statuses;
DROP POLICY IF EXISTS "Authenticated read bonus_source_statuses" ON public.bonus_source_statuses;
CREATE POLICY "Public read bonus_source_statuses" ON public.bonus_source_statuses
  AS PERMISSIVE FOR SELECT TO anon, authenticated
  USING (true);

-- ---- project_contracted_hours: 3 identical authenticated SELECT(true) -> keep 1
--      ("Authenticated read project_contracted_hours" + "Authenticated users can read contracted hours");
--      "Anon read project_contracted_hours" kept separately (anon role).
DROP POLICY IF EXISTS "Authenticated users can read contracted hours" ON public.project_contracted_hours;
-- "Authenticated read project_contracted_hours" (authenticated, true) is retained.
-- TODO(out-of-scope): "Anon write project_contracted_hours" (anon ALL true) left unchanged.

-- ---- Tables with SELECT authenticated(true) duplicated by an "ALL anon true" that
--      also covers SELECT for anon. The authenticated SELECT is NOT redundant with the
--      anon ALL policy (different role), so both are retained; remove only true intra-role
--      SELECT duplicates. For client_kpis / client_benchmarks / health_score_config /
--      project_financials / user_capacity there is a single authenticated SELECT(true)
--      plus a single anon SELECT(true) (via ALL) — these are distinct roles, NOT
--      duplicates, so NO drop is required to preserve behavior.
--      client_benchmarks is the only one with an extra authenticated SELECT duplicate:
DROP POLICY IF EXISTS "Authenticated read benchmarks" ON public.client_benchmarks;
-- "Anon read client_benchmarks" (anon, true) is retained for the anon role.
-- TODO(out-of-scope): anon ALL(true) write policies on client_kpis/client_benchmarks/
-- health_score_config/project_financials/user_capacity left unchanged.

COMMIT;

-- =====================================================================
-- ROLLBACK (1:1 restore of original definitions). Run inside a transaction.
-- =====================================================================
-- BEGIN;
--
-- -- audit_log
-- DROP POLICY IF EXISTS "service_role_audit" ON public.audit_log;
-- CREATE POLICY "service_role_audit" ON public.audit_log AS PERMISSIVE FOR ALL TO public
--   USING (auth.role() = 'service_role'::text) WITH CHECK (auth.role() = 'service_role'::text);
-- DROP POLICY IF EXISTS "admins_insert_audit" ON public.audit_log;
-- CREATE POLICY "admins_insert_audit" ON public.audit_log AS PERMISSIVE FOR INSERT TO authenticated
--   WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
-- DROP POLICY IF EXISTS "Admin read audit" ON public.audit_log;
-- CREATE POLICY "Admin read audit" ON public.audit_log AS PERMISSIVE FOR SELECT TO authenticated
--   USING (EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::app_role))));
-- DROP POLICY IF EXISTS "admins_read_audit" ON public.audit_log;
-- CREATE POLICY "admins_read_audit" ON public.audit_log AS PERMISSIVE FOR SELECT TO authenticated
--   USING (has_role(auth.uid(), 'admin'::app_role));
--
-- -- reponsonsibles_tasks_users
-- DROP POLICY IF EXISTS "Users can read own record in reponsonsibles_tasks_users" ON public.reponsonsibles_tasks_users;
-- CREATE POLICY "Users can read own record in reponsonsibles_tasks_users" ON public.reponsonsibles_tasks_users
--   AS PERMISSIVE FOR SELECT TO authenticated USING (auth.uid() = auth_user_id);
--
-- -- project_contracted_hours
-- DROP POLICY IF EXISTS "Admins can delete contracted hours" ON public.project_contracted_hours;
-- CREATE POLICY "Admins can delete contracted hours" ON public.project_contracted_hours AS PERMISSIVE FOR DELETE TO authenticated
--   USING (EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::app_role))));
-- DROP POLICY IF EXISTS "Admins can insert contracted hours" ON public.project_contracted_hours;
-- CREATE POLICY "Admins can insert contracted hours" ON public.project_contracted_hours AS PERMISSIVE FOR INSERT TO authenticated
--   WITH CHECK (EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::app_role))));
-- DROP POLICY IF EXISTS "Admins can update contracted hours" ON public.project_contracted_hours;
-- CREATE POLICY "Admins can update contracted hours" ON public.project_contracted_hours AS PERMISSIVE FOR UPDATE TO authenticated
--   USING (EXISTS ( SELECT 1 FROM user_roles WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::app_role))));
-- DROP POLICY IF EXISTS "Authenticated read project_contracted_hours" ON public.project_contracted_hours;
-- CREATE POLICY "Authenticated read project_contracted_hours" ON public.project_contracted_hours AS PERMISSIVE FOR SELECT TO authenticated USING (true);
-- CREATE POLICY "Authenticated users can read contracted hours" ON public.project_contracted_hours AS PERMISSIVE FOR SELECT TO authenticated USING (true);
--
-- -- user_allowed_areas
-- DROP POLICY IF EXISTS "admins_manage_areas" ON public.user_allowed_areas;
-- CREATE POLICY "admins_manage_areas" ON public.user_allowed_areas AS PERMISSIVE FOR ALL TO authenticated
--   USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
-- DROP POLICY IF EXISTS "service_role_uaa" ON public.user_allowed_areas;
-- CREATE POLICY "service_role_uaa" ON public.user_allowed_areas AS PERMISSIVE FOR ALL TO public
--   USING (auth.role() = 'service_role'::text) WITH CHECK (auth.role() = 'service_role'::text);
-- DROP POLICY IF EXISTS "users_see_own_areas" ON public.user_allowed_areas;
-- CREATE POLICY "users_see_own_areas" ON public.user_allowed_areas AS PERMISSIVE FOR SELECT TO authenticated USING (auth.uid() = user_id);
--
-- -- user_capacity
-- DROP POLICY IF EXISTS "Users read own capacity" ON public.user_capacity;
-- CREATE POLICY "Users read own capacity" ON public.user_capacity AS PERMISSIVE FOR SELECT TO authenticated USING (user_id = auth.uid());
--
-- -- user_project_access
-- DROP POLICY IF EXISTS "admins_manage_project_access" ON public.user_project_access;
-- CREATE POLICY "admins_manage_project_access" ON public.user_project_access AS PERMISSIVE FOR ALL TO authenticated
--   USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
-- DROP POLICY IF EXISTS "service_role_upa" ON public.user_project_access;
-- CREATE POLICY "service_role_upa" ON public.user_project_access AS PERMISSIVE FOR ALL TO public
--   USING (auth.role() = 'service_role'::text) WITH CHECK (auth.role() = 'service_role'::text);
-- DROP POLICY IF EXISTS "users_see_own_project_access" ON public.user_project_access;
-- CREATE POLICY "users_see_own_project_access" ON public.user_project_access AS PERMISSIVE FOR SELECT TO authenticated USING (auth.uid() = user_id);
--
-- -- user_roles
-- DROP POLICY IF EXISTS "admins_manage_roles" ON public.user_roles;
-- CREATE POLICY "admins_manage_roles" ON public.user_roles AS PERMISSIVE FOR ALL TO authenticated
--   USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
-- DROP POLICY IF EXISTS "service_role_roles" ON public.user_roles;
-- CREATE POLICY "service_role_roles" ON public.user_roles AS PERMISSIVE FOR ALL TO public
--   USING (auth.role() = 'service_role'::text) WITH CHECK (auth.role() = 'service_role'::text);
-- DROP POLICY IF EXISTS "users_see_own_role" ON public.user_roles;
-- CREATE POLICY "users_see_own_role" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING (auth.uid() = user_id);
--
-- -- users
-- DROP POLICY IF EXISTS "admins_full_access" ON public.users;
-- CREATE POLICY "admins_full_access" ON public.users AS PERMISSIVE FOR ALL TO authenticated
--   USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
-- DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
-- CREATE POLICY "Admins can view all users" ON public.users AS PERMISSIVE FOR SELECT TO public
--   USING (is_admin_user() OR (auth_user_id = auth.uid()));
-- DROP POLICY IF EXISTS "users_select_own" ON public.users;
-- CREATE POLICY "users_select_own" ON public.users AS PERMISSIVE FOR SELECT TO public USING (auth.uid() = auth_user_id);
-- DROP POLICY IF EXISTS "Users can update own or admin all" ON public.users;
-- CREATE POLICY "Users can update own or admin all" ON public.users AS PERMISSIVE FOR UPDATE TO authenticated
--   USING ((auth_user_id = auth.uid()) OR is_admin())
--   WITH CHECK (CASE WHEN is_admin() THEN true ELSE ((auth_user_id = auth.uid()) AND (auth_user_id = auth.uid()) AND (active = true)) END);
-- DROP POLICY IF EXISTS "users_update_own" ON public.users;
-- CREATE POLICY "users_update_own" ON public.users AS PERMISSIVE FOR UPDATE TO public
--   USING (auth.uid() = auth_user_id) WITH CHECK (auth.uid() = auth_user_id);
--
-- -- bonus_evaluation_reminders
-- DROP POLICY IF EXISTS "Managers read reminder history" ON public.bonus_evaluation_reminders;
-- CREATE POLICY "Managers read reminder history" ON public.bonus_evaluation_reminders AS PERMISSIVE FOR SELECT TO authenticated
--   USING (is_admin() OR current_user_is_payment_manager() OR (EXISTS ( SELECT 1 FROM users u
--     WHERE ((u.auth_user_id = auth.uid()) AND ((u.id = bonus_evaluation_reminders.coordinator_user_id) OR (u.id = bonus_evaluation_reminders.subordinate_user_id) OR (u.role = ANY (ARRAY['admin'::text, 'gestor'::text])))))));
--
-- -- bonus_report_emails
-- DROP POLICY IF EXISTS "Managers read report email history" ON public.bonus_report_emails;
-- CREATE POLICY "Managers read report email history" ON public.bonus_report_emails AS PERMISSIVE FOR SELECT TO authenticated
--   USING (is_admin() OR current_user_is_payment_manager() OR (EXISTS ( SELECT 1 FROM users u
--     WHERE ((u.auth_user_id = auth.uid()) AND ((u.id = bonus_report_emails.consultant_user_id) OR (u.id = bonus_report_emails.sent_by_user_id) OR (u.role = ANY (ARRAY['admin'::text, 'gestor'::text])))))));
--
-- -- user_coordinator_links
-- DROP POLICY IF EXISTS "Managers read coordinator links" ON public.user_coordinator_links;
-- CREATE POLICY "Managers read coordinator links" ON public.user_coordinator_links AS PERMISSIVE FOR SELECT TO authenticated
--   USING (is_admin() OR current_user_is_payment_manager() OR (EXISTS ( SELECT 1 FROM users u
--     WHERE ((u.auth_user_id = auth.uid()) AND ((u.id = user_coordinator_links.coordinator_user_id) OR (u.id = user_coordinator_links.subordinate_user_id) OR (u.role = ANY (ARRAY['admin'::text, 'gestor'::text])))))));
--
-- -- bonus_metric_breakdowns (restore two separate role policies)
-- DROP POLICY IF EXISTS "Public read bonus_metric_breakdowns" ON public.bonus_metric_breakdowns;
-- CREATE POLICY "Anon read bonus_metric_breakdowns" ON public.bonus_metric_breakdowns AS PERMISSIVE FOR SELECT TO anon USING (true);
-- CREATE POLICY "Authenticated read bonus_metric_breakdowns" ON public.bonus_metric_breakdowns AS PERMISSIVE FOR SELECT TO authenticated USING (true);
--
-- -- bonus_source_statuses
-- DROP POLICY IF EXISTS "Public read bonus_source_statuses" ON public.bonus_source_statuses;
-- CREATE POLICY "Anon read bonus_source_statuses" ON public.bonus_source_statuses AS PERMISSIVE FOR SELECT TO anon USING (true);
-- CREATE POLICY "Authenticated read bonus_source_statuses" ON public.bonus_source_statuses AS PERMISSIVE FOR SELECT TO authenticated USING (true);
--
-- -- client_benchmarks
-- CREATE POLICY "Authenticated read benchmarks" ON public.client_benchmarks AS PERMISSIVE FOR SELECT TO authenticated USING (true);
--
-- COMMIT;
