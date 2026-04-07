import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/* ═══════════════════════════════════════════════════════════════
 *  CORS
 * ═══════════════════════════════════════════════════════════════ */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ═══════════════════════════════════════════════════════════════
 *  External Supabase (ISP Consulte) — public keys are safe
 * ═══════════════════════════════════════════════════════════════ */
const EXT_URL = "https://stubkeeuttixteqckshd.supabase.co";
const EXT_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0dWJrZWV1dHRpeHRlcWNrc2hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NjQ0OTIsImV4cCI6MjA3MzA0MDQ5Mn0.YcpSKrTSb1P1REC8lgkdduDITX52h_z7ArPD6XIkrlU";

/* ═══════════════════════════════════════════════════════════════
 *  Constants & helpers
 * ═══════════════════════════════════════════════════════════════ */
const VALID_ACTIONS = ["list", "create", "update", "delete", "deactivate", "cleanup_orphans", "reset_password"] as const;
type Action = (typeof VALID_ACTIONS)[number];

const MANAGER_ROLES = new Set(["admin", "gerente", "coordenador"]);

const PROFILE_TO_ROLE: Record<string, string> = {
  Administrador: "admin",
  Consultor: "consultor",
  Gerente: "gerente",
  Coordenador: "coordenador",
  Cliente: "cliente",
};

function profileToAppRole(profile: string | null | undefined): string {
  const normalizedProfile = validateString(profile) ?? "Consultor";
  return PROFILE_TO_ROLE[normalizedProfile] ?? "consultor";
}

const ROLE_TO_PERFIL: Record<string, string> = {
  admin: "Administrador",
  consultor: "Consultor",
  gerente: "Gerente",
  coordenador: "Coordenador",
  cliente: "Cliente",
};

const VALID_AREAS = new Set(["home", "tarefas", "analiticas", "calendario", "gamificacao", "ferramentas", "comodato", "integracoes", "usuarios", "suporte", "sprint", "bonificacao", "clientes", "diagnostico"]);
const VALID_BONUS_ROLES = new Set(["admin", "gestor", "consultor"]);
const VALID_SENIORITIES = new Set(["junior", "pleno", "senior"]);

/** Structured log helper */
function log(level: "info" | "warn" | "error", action: string, msg: string, meta?: Record<string, unknown>) {
  const entry = { ts: new Date().toISOString(), level, action, msg, ...meta };
  if (level === "error") console.error(JSON.stringify(entry));
  else if (level === "warn") console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errRes(message: string, status = 400) {
  return jsonRes({ ok: false, error: message }, status);
}

/** Translate common Supabase Auth errors to Portuguese */
function translateError(msg: string): string {
  const map: Record<string, string> = {
    "A user with this email address has already been registered": "Já existe um usuário com este e-mail.",
    "User not found": "Usuário não encontrado.",
    "Invalid login credentials": "Credenciais inválidas.",
    "Email not confirmed": "E-mail não confirmado.",
    "Password should be at least 6 characters": "A senha deve ter pelo menos 6 caracteres.",
    "Unable to validate email address: invalid format": "Formato de e-mail inválido.",
    "Signup requires a valid password": "É necessário uma senha válida.",
    "User already registered": "Usuário já registrado.",
    "Database error deleting user": "Erro ao excluir usuário do banco de dados.",
    "Database error saving new user": "Erro ao salvar novo usuário no banco de dados.",
  };
  for (const [en, pt] of Object.entries(map)) {
    if (msg.toLowerCase().includes(en.toLowerCase())) return pt;
  }
  return msg;
}

/* ═══════════════════════════════════════════════════════════════
 *  Input validation helpers
 * ═══════════════════════════════════════════════════════════════ */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email: unknown): string | null {
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) return null;
  return email.trim().toLowerCase();
}

function validateString(value: unknown, maxLen = 255): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim().slice(0, maxLen);
  return s.length > 0 ? s : null;
}

function validateAreas(areas: unknown): string[] | null {
  if (!Array.isArray(areas)) return null;
  return areas.filter((a): a is string => typeof a === "string" && VALID_AREAS.has(a));
}

function validateProjectIds(ids: unknown): number[] | null {
  if (!Array.isArray(ids)) return null;
  return ids.filter((id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0);
}

function validateClienteId(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function validateBonusRole(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).trim().toLowerCase();
  return VALID_BONUS_ROLES.has(normalized) ? normalized : null;
}

function validateSeniority(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).trim().toLowerCase();
  return VALID_SENIORITIES.has(normalized) ? normalized : null;
}

function validateBigintId(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function validateBigintIdArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => validateBigintId(item))
    .filter((item): item is number => item !== null);
}

function uniqueNumbers(values: number[]) {
  return Array.from(new Set(values.filter((value) => Number.isInteger(value) && value > 0)));
}

/* ═══════════════════════════════════════════════════════════════
 *  Safe DB operations with error aggregation
 * ═══════════════════════════════════════════════════════════════ */
type DbResult = { ok: boolean; error?: string };

async function safeDelete(client: SupabaseClient, table: string, column: string, value: string | number): Promise<DbResult> {
  const { error } = await client.from(table).delete().eq(column, value);
  if (error) {
    log("warn", "safeDelete", `Failed to delete from ${table}`, { column, value, err: error.message });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

async function safeInsert(client: SupabaseClient, table: string, rows: Record<string, unknown>[]): Promise<DbResult> {
  if (rows.length === 0) return { ok: true };
  const { error } = await client.from(table).insert(rows);
  if (error) {
    log("warn", "safeInsert", `Failed to insert into ${table}`, { count: rows.length, err: error.message });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Sync pattern: delete all existing + insert new. Returns warnings. */
async function syncRelated(
  client: SupabaseClient,
  table: string,
  userIdCol: string,
  userId: string | number,
  rows: Record<string, unknown>[],
): Promise<string[]> {
  const warnings: string[] = [];
  const del = await safeDelete(client, table, userIdCol, userId);
  if (!del.ok) warnings.push(`Aviso: falha ao limpar ${table}: ${del.error}`);
  if (rows.length > 0) {
    const ins = await safeInsert(client, table, rows);
    if (!ins.ok) warnings.push(`Aviso: falha ao inserir em ${table}: ${ins.error}`);
  }
  return warnings;
}

/* ═══════════════════════════════════════════════════════════════
 *  Auth & role resolution
 * ═══════════════════════════════════════════════════════════════ */
async function resolveCallerRole(adminClient: SupabaseClient, uid: string): Promise<string | null> {
  // 1. Try user_roles table
  const { data: roleRows } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", uid)
    .limit(1);

  if (roleRows?.[0]?.role) return roleRows[0].role;

  // 2. Fallback: users.user_profile
  const { data: userRows } = await adminClient
    .from("users")
    .select("user_profile")
    .eq("auth_user_id", uid)
    .limit(1);

  const profile = userRows?.[0]?.user_profile;
  return profile ? (PROFILE_TO_ROLE[profile] ?? "consultor") : null;
}

/* ═══════════════════════════════════════════════════════════════
 *  Audit helper
 * ═══════════════════════════════════════════════════════════════ */
async function audit(
  client: SupabaseClient,
  performedBy: string,
  targetUserId: string | null,
  action: string,
  details: Record<string, unknown>,
) {
  const { error } = await client.from("audit_log").insert({
    performed_by: performedBy,
    target_user_id: targetUserId,
    action,
    details,
  });
  if (error) {
    log("warn", action, "Failed to write audit log", { err: error.message });
  }
}

/* ═══════════════════════════════════════════════════════════════
 *  MAIN HANDLER
 * ═══════════════════════════════════════════════════════════════ */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    /* ── Auth check ── */
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errRes("Não autorizado.", 401);
    }

    const extServiceRoleKey = Deno.env.get("EXT_SUPABASE_SERVICE_ROLE_KEY");
    if (!extServiceRoleKey) {
      log("error", "init", "EXT_SUPABASE_SERVICE_ROLE_KEY not set");
      return errRes("Configuração do servidor incompleta.", 500);
    }

    const token = authHeader.replace("Bearer ", "");
    const callerClient = createClient(EXT_URL, EXT_ANON, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await callerClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return errRes("Token inválido.", 401);
    }

    const callerUid = userData.user.id;
    const adminClient = createClient(EXT_URL, extServiceRoleKey);

    /* ── Role gate ── */
    const callerRole = await resolveCallerRole(adminClient, callerUid);
    if (!callerRole || !MANAGER_ROLES.has(callerRole)) {
      log("warn", "auth", "Non-manager attempted access", { uid: callerUid, role: callerRole });
      return errRes("Apenas administradores podem gerenciar usuários.", 403);
    }

    /* ── Parse & validate action ── */
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errRes("Corpo da requisição inválido (JSON esperado).");
    }

    const action = body.action as string;
    if (!VALID_ACTIONS.includes(action as Action)) {
      return errRes(`Ação inválida: '${action}'. Use: ${VALID_ACTIONS.join(", ")}.`);
    }

    log("info", action, "Request started", { rid: requestId, caller: callerUid });

    /* ═══════════════════════════════════════════ */
    /* ─── LIST ─── */
    /* ═══════════════════════════════════════════ */
    if (action === "list") {
      const [usersRes, rolesRes, areasRes, accessRes, coordinatorLinksRes] = await Promise.all([
        adminClient.from("users").select("id,auth_user_id,email,name,user_profile,active,cliente_id,seniority,role,bitrix_user_id").order("name", { ascending: true }).limit(500),
        adminClient.from("user_roles").select("user_id,role").limit(1000),
        adminClient.from("user_allowed_areas").select("user_id,area_name").limit(5000),
        adminClient.from("user_project_access").select("user_id,project_id").limit(5000),
        adminClient.from("user_coordinator_links").select("coordinator_user_id,subordinate_user_id").limit(5000),
      ]);

      if (usersRes.error) {
        log("error", "list", "Failed to fetch users", { err: usersRes.error.message });
        return errRes(`Falha ao listar usuários: ${usersRes.error.message}`);
      }

      const roleMap = new Map<string, string>();
      (rolesRes.data ?? []).forEach((r: { user_id: string; role: string }) => roleMap.set(r.user_id, r.role));

      const areaMap = new Map<string, string[]>();
      (areasRes.data ?? []).forEach((a: { user_id: string; area_name: string }) => {
        const arr = areaMap.get(a.user_id) ?? [];
        arr.push(a.area_name);
        areaMap.set(a.user_id, arr);
      });

      const projectMap = new Map<string, number[]>();
      (accessRes.data ?? []).forEach((p: { user_id: string; project_id: number }) => {
        const arr = projectMap.get(p.user_id) ?? [];
        arr.push(p.project_id);
        projectMap.set(p.user_id, arr);
      });

      const subordinatesMap = new Map<string, string[]>();
      const coordinatorBySubordinate = new Map<string, string>();
      (coordinatorLinksRes.data ?? []).forEach((link: { coordinator_user_id: string | number; subordinate_user_id: string | number }) => {
        const coordinatorId = String(link.coordinator_user_id ?? "");
        const subordinateId = String(link.subordinate_user_id ?? "");
        if (!coordinatorId || !subordinateId) return;
        const arr = subordinatesMap.get(coordinatorId) ?? [];
        arr.push(subordinateId);
        subordinatesMap.set(coordinatorId, arr);
        coordinatorBySubordinate.set(subordinateId, coordinatorId);
      });

      const users = (usersRes.data ?? []).map((u: Record<string, unknown>) => {
        const authUid = String(u.auth_user_id ?? "");
        const dbRole = roleMap.get(authUid);
        const userId = String(u.id ?? "");
        const bonusRole = validateBonusRole(u.role) ?? (dbRole === "admin" ? "admin" : dbRole === "gerente" || dbRole === "coordenador" ? "gestor" : "consultor");
        return {
          id: userId,
          auth_user_id: authUid,
          email: String(u.email ?? ""),
          name: String(u.name ?? ""),
          user_profile: dbRole ? (ROLE_TO_PERFIL[dbRole] ?? String(u.user_profile ?? "Consultor")) : String(u.user_profile ?? "Consultor"),
          active: u.active !== false,
          role: dbRole ?? null,
          bonus_role: bonusRole,
          seniority: validateSeniority(u.seniority),
          subordinate_ids: subordinatesMap.get(userId) ?? [],
          my_coordinator: coordinatorBySubordinate.get(userId) ?? null,
          bitrix_user_id: typeof u.bitrix_user_id === "string" ? u.bitrix_user_id : null,
          cliente_id: u.cliente_id ?? null,
          areas: areaMap.get(authUid) ?? [],
          projects: projectMap.get(authUid) ?? [],
        };
      });

      log("info", "list", "Success", { rid: requestId, count: users.length });
      return jsonRes({ ok: true, data: users });
    }

    /* ═══════════════════════════════════════════ */
    /* ─── CREATE ─── */
    /* ═══════════════════════════════════════════ */
    if (action === "create") {
      const email = validateEmail(body.email);
      if (!email) return errRes("E-mail inválido ou ausente.");

      const password = validateString(body.password, 128);
      if (!password || password.length < 6) return errRes("Senha deve ter pelo menos 6 caracteres.");

      const name = validateString(body.name) ?? "";
      const userProfile = validateString(body.user_profile) ?? "Consultor";
      const areas = validateAreas(body.areas) ?? [];
      const projects = validateProjectIds(body.projects) ?? [];
      const clienteId = validateClienteId(body.cliente_id);
      const bonusRole = validateBonusRole(body.role) ?? validateBonusRole(body.bonus_role) ?? "consultor";
      const seniority = validateSeniority(body.seniority);
      const myCoordinator = validateBigintId(body.my_coordinator);
      const subordinateIds = validateBigintIdArray(body.subordinate_ids);
      const bitrixUserId = validateString(body.bitrix_user_id, 120);
      const role = profileToAppRole(userProfile);

      // 1. Create or recover auth user
      let authUserId: string;
      let recoveredOrphan = false;

      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, user_profile: userProfile },
      });

      if (authError) {
        const isAlreadyRegistered =
          authError.message.toLowerCase().includes("already been registered") ||
          authError.message.toLowerCase().includes("already registered") ||
          authError.message.toLowerCase().includes("user already");

        if (!isAlreadyRegistered) {
          return errRes(translateError(authError.message));
        }

        // Attempt orphan recovery
        const { data: listData } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
        const existingAuthUser = listData?.users?.find(
          (u: { email?: string }) => u.email?.toLowerCase() === email,
        );

        if (!existingAuthUser) {
          return errRes("E-mail já registrado no Auth, mas não foi possível localizar o usuário.");
        }

        // Check if already linked in users table
        const { data: existingRows } = await adminClient
          .from("users")
          .select("id")
          .eq("auth_user_id", existingAuthUser.id)
          .limit(1);

        if (existingRows && existingRows.length > 0) {
          return errRes("Já existe um usuário ativo com este e-mail. Edite-o na lista.");
        }

        // Re-link orphan
        await adminClient.auth.admin.updateUserById(existingAuthUser.id, {
          password,
          email_confirm: true,
          user_metadata: { name, user_profile: userProfile },
        });

        authUserId = existingAuthUser.id;
        recoveredOrphan = true;
        log("info", "create", "Recovered orphan auth user", { email, authUserId });
      } else {
        authUserId = authData.user.id;
      }

      // 2. Upsert users table
      const userRow: Record<string, unknown> = {
        auth_user_id: authUserId,
        email,
        name,
        user_profile: userProfile,
        active: true,
        role: bonusRole,
        seniority,
      };
      if (clienteId !== null) userRow.cliente_id = clienteId;
      if (bitrixUserId) userRow.bitrix_user_id = bitrixUserId;

      const { data: upsertedUser, error: upsertErr } = await adminClient
        .from("users")
        .upsert(userRow, { onConflict: "auth_user_id" })
        .select("id")
        .single();

      if (upsertErr) {
        log("error", "create", "Failed to upsert user row", { email, err: upsertErr.message });
        return errRes(`Falha ao criar registro: ${translateError(upsertErr.message)}`);
      }

      // 3. Sync role, areas, projects (collect warnings)
      const warnings: string[] = [];

      const roleWarnings = await syncRelated(adminClient, "user_roles", "user_id", authUserId, [
        { user_id: authUserId, role },
      ]);
      warnings.push(...roleWarnings);

      const areaRows = areas.map((a) => ({ user_id: authUserId, area_name: a }));
      const areaWarnings = await syncRelated(adminClient, "user_allowed_areas", "user_id", authUserId, areaRows);
      warnings.push(...areaWarnings);

      const projRows = projects.map((pid) => ({ user_id: authUserId, project_id: pid }));
      const projWarnings = await syncRelated(adminClient, "user_project_access", "user_id", authUserId, projRows);
      warnings.push(...projWarnings);

      if (upsertedUser?.id) {
        if (bonusRole === "consultor") {
          const { error: deleteExistingCoordinatorError } = await adminClient
            .from("user_coordinator_links")
            .delete()
            .eq("subordinate_user_id", upsertedUser.id);
          if (deleteExistingCoordinatorError) {
            warnings.push(`Aviso: falha ao limpar coordenador anterior: ${deleteExistingCoordinatorError.message}`);
          }
          if (myCoordinator) {
            const coordinatorInsert = await safeInsert(adminClient, "user_coordinator_links", [
              { coordinator_user_id: myCoordinator, subordinate_user_id: upsertedUser.id },
            ]);
            if (!coordinatorInsert.ok) warnings.push(`Aviso: falha ao inserir coordenador: ${coordinatorInsert.error}`);
          }
        } else {
          const coordinatorRows = uniqueNumbers(subordinateIds).map((subordinateId) => ({
            coordinator_user_id: upsertedUser.id,
            subordinate_user_id: subordinateId,
          }));
          const coordinatorWarnings = await syncRelated(adminClient, "user_coordinator_links", "coordinator_user_id", upsertedUser.id, coordinatorRows);
          warnings.push(...coordinatorWarnings);
        }
      }

      // 4. Audit
      await audit(adminClient, callerUid, authUserId, "create_user", {
        email, name, user_profile: userProfile, areas, projects, clienteId,
        bonus_role: bonusRole, seniority, my_coordinator: myCoordinator, subordinate_ids: subordinateIds,
        recovered_orphan: recoveredOrphan,
      });

      log("info", "create", "User created", { rid: requestId, authUserId, warnings });
      return jsonRes({
        ok: true,
        data: { authUserId, email, name, user_profile: userProfile },
        ...(warnings.length > 0 ? { warnings } : {}),
      });
    }

    /* ═══════════════════════════════════════════ */
    /* ─── UPDATE ─── */
    /* ═══════════════════════════════════════════ */
    if (action === "update") {
      const userId = validateString(body.userId as string);
      const targetAuthUserId = validateString(body.authUserId as string);

      if (!userId || !targetAuthUserId) {
        return errRes("userId e authUserId são obrigatórios.");
      }

      const payload = (body.payload ?? {}) as Record<string, unknown>;
      const warnings: string[] = [];
      const bonusRole = validateBonusRole(payload.role ?? payload.bonus_role ?? body.role ?? body.bonus_role);
      const seniority = validateSeniority(payload.seniority);
      const myCoordinator = validateBigintId(body.my_coordinator ?? payload.my_coordinator);
      const subordinateIds = validateBigintIdArray(body.subordinate_ids);
      const bitrixUserId = validateString(payload.bitrix_user_id, 120);

      // 1. Build & apply user table update
      const userPayload: Record<string, unknown> = {};
      if (payload.name !== undefined) userPayload.name = validateString(payload.name) ?? "";
      if (payload.email !== undefined) {
        const validEmail = validateEmail(payload.email);
        if (!validEmail) return errRes("E-mail inválido.");
        userPayload.email = validEmail;
      }
      if (payload.user_profile !== undefined) userPayload.user_profile = validateString(payload.user_profile) ?? "Consultor";
      if (payload.active !== undefined) userPayload.active = Boolean(payload.active);
      if (payload.cliente_id !== undefined) {
        userPayload.cliente_id = payload.cliente_id === null ? null : validateClienteId(payload.cliente_id);
      }
      if (bonusRole !== null) userPayload.role = bonusRole;
      if (payload.seniority !== undefined) userPayload.seniority = seniority;
      if (payload.bitrix_user_id !== undefined) userPayload.bitrix_user_id = bitrixUserId;

      if (Object.keys(userPayload).length > 0) {
        const { error: updateError } = await adminClient
          .from("users")
          .update(userPayload)
          .eq("id", userId);
        if (updateError) {
          log("error", "update", "Failed to update user row", { userId, err: updateError.message });
          return errRes(`Falha ao atualizar usuário: ${translateError(updateError.message)}`);
        }
      }

      // 2. Sync role
      if (payload.user_profile !== undefined) {
        const role = profileToAppRole(validateString(payload.user_profile) ?? "Consultor");
        const roleW = await syncRelated(adminClient, "user_roles", "user_id", targetAuthUserId, [
          { user_id: targetAuthUserId, role },
        ]);
        warnings.push(...roleW);
      }

      // 3. Sync allowed areas
      if (Array.isArray(body.areas)) {
        const validAreas = validateAreas(body.areas) ?? [];
        const areaRows = validAreas.map((a) => ({ user_id: targetAuthUserId, area_name: a }));
        const areaW = await syncRelated(adminClient, "user_allowed_areas", "user_id", targetAuthUserId, areaRows);
        warnings.push(...areaW);
      }

      // 4. Sync project access
      if (Array.isArray(body.projects)) {
        const validProjects = validateProjectIds(body.projects) ?? [];
        const projRows = validProjects.map((pid) => ({ user_id: targetAuthUserId, project_id: pid }));
        const projW = await syncRelated(adminClient, "user_project_access", "user_id", targetAuthUserId, projRows);
        warnings.push(...projW);
      }

      if (body.subordinate_ids !== undefined) {
        const coordinatorRows = subordinateIds.map((subordinateId) => ({
          coordinator_user_id: userId,
          subordinate_user_id: subordinateId,
        }));
        const coordinatorWarnings = await syncRelated(adminClient, "user_coordinator_links", "coordinator_user_id", userId, coordinatorRows);
        warnings.push(...coordinatorWarnings);
      }

      if (body.my_coordinator !== undefined || payload.my_coordinator !== undefined) {
        const { error: deleteExistingCoordinatorError } = await adminClient
          .from("user_coordinator_links")
          .delete()
          .eq("subordinate_user_id", userId);
        if (deleteExistingCoordinatorError) {
          warnings.push(`Aviso: falha ao limpar coordenador anterior: ${deleteExistingCoordinatorError.message}`);
        }
        if (myCoordinator) {
          const coordinatorInsert = await safeInsert(adminClient, "user_coordinator_links", [
            { coordinator_user_id: myCoordinator, subordinate_user_id: userId },
          ]);
          if (!coordinatorInsert.ok) warnings.push(`Aviso: falha ao inserir coordenador: ${coordinatorInsert.error}`);
        }
      }

      // 5. Audit
      await audit(adminClient, callerUid, targetAuthUserId, "update_user", {
        userId, changes: userPayload, areas: body.areas, projects: body.projects, my_coordinator: myCoordinator, subordinate_ids: subordinateIds,
      });

      log("info", "update", "User updated", { rid: requestId, userId, warnings });
      return jsonRes({ ok: true, ...(warnings.length > 0 ? { warnings } : {}) });
    }

    /* ═══════════════════════════════════════════ */
    /* ─── DELETE ─── */
    /* ═══════════════════════════════════════════ */
    if (action === "delete") {
      const authUserId = validateString(body.authUserId as string);
      if (!authUserId) return errRes("authUserId é obrigatório.");

      // Prevent self-deletion
      if (authUserId === callerUid) {
        return errRes("Não é possível excluir seu próprio usuário.");
      }

      // 1. Clean up DB records FIRST
      const tables = ["user_project_access", "user_allowed_areas", "user_roles"];
      for (const table of tables) {
        await safeDelete(adminClient, table, "user_id", authUserId);
      }
      await safeDelete(adminClient, "users", "auth_user_id", authUserId);

      // 2. Delete auth user
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(authUserId);
      if (deleteError) {
        log("warn", "delete", "Auth user deletion failed (may already be deleted)", { authUserId, err: deleteError.message });
      }

      await audit(adminClient, callerUid, authUserId, "delete_user", { authUserId });
      log("info", "delete", "User deleted", { rid: requestId, authUserId });
      return jsonRes({ ok: true });
    }

    /* ═══════════════════════════════════════════ */
    /* ─── DEACTIVATE ─── */
    /* ═══════════════════════════════════════════ */
    if (action === "deactivate") {
      const userId = validateString(body.userId as string);
      const targetAuthUserId = validateString(body.authUserId as string);
      if (!userId || !targetAuthUserId) return errRes("userId e authUserId são obrigatórios.");

      const { error } = await adminClient.from("users").update({ active: false }).eq("id", userId);
      if (error) {
        return errRes(`Falha ao desativar: ${translateError(error.message)}`);
      }

      // Revoke access but keep records for reactivation
      await safeDelete(adminClient, "user_allowed_areas", "user_id", targetAuthUserId);
      await safeDelete(adminClient, "user_project_access", "user_id", targetAuthUserId);

      await audit(adminClient, callerUid, targetAuthUserId, "deactivate_user", { userId });
      log("info", "deactivate", "User deactivated", { rid: requestId, userId });
      return jsonRes({ ok: true });
    }

    /* ═══════════════════════════════════════════ */
    /* ─── RESET PASSWORD ─── */
    /* ═══════════════════════════════════════════ */
    if (action === "reset_password") {
      const targetAuthUserId = validateString(body.authUserId as string);
      if (!targetAuthUserId) return errRes("authUserId é obrigatório.");

      const newPassword = validateString(body.newPassword as string, 128);
      if (!newPassword || newPassword.length < 6) {
        return errRes("A nova senha deve ter pelo menos 6 caracteres.");
      }

      const { error: pwError } = await adminClient.auth.admin.updateUserById(targetAuthUserId, {
        password: newPassword,
      });

      if (pwError) {
        log("error", "reset_password", "Failed to update password", { targetAuthUserId, err: pwError.message });
        return errRes(`Falha ao redefinir senha: ${translateError(pwError.message)}`);
      }

      await audit(adminClient, callerUid, targetAuthUserId, "reset_password", {
        targetAuthUserId,
      });

      log("info", "reset_password", "Password reset", { rid: requestId, targetAuthUserId });
      return jsonRes({ ok: true });
    }

    /* ═══════════════════════════════════════════ */
    /* ─── CLEANUP ORPHANS ─── */
    /* ═══════════════════════════════════════════ */
    if (action === "cleanup_orphans") {
      const { data: listData, error: listErr } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      if (listErr) return errRes(`Falha ao listar auth: ${listErr.message}`);

      const { data: dbUsers } = await adminClient
        .from("users")
        .select("auth_user_id")
        .limit(5000);

      const dbSet = new Set((dbUsers ?? []).map((u: { auth_user_id: string }) => u.auth_user_id));

      const orphans: string[] = [];
      const errors: string[] = [];

      for (const authUser of listData?.users ?? []) {
        if (!dbSet.has(authUser.id)) {
          // Clean up related records
          for (const table of ["user_project_access", "user_allowed_areas", "user_roles"]) {
            await safeDelete(adminClient, table, "user_id", authUser.id);
          }
          const { error: delErr } = await adminClient.auth.admin.deleteUser(authUser.id);
          if (delErr) {
            errors.push(`${authUser.email ?? authUser.id}: ${delErr.message}`);
          } else {
            orphans.push(authUser.email ?? authUser.id);
          }
        }
      }

      await audit(adminClient, callerUid, null, "cleanup_orphans", {
        removed: orphans,
        errors: errors.length > 0 ? errors : undefined,
      });

      log("info", "cleanup_orphans", "Completed", { rid: requestId, removed: orphans.length, errors: errors.length });
      return jsonRes({ ok: true, data: { removed: orphans, count: orphans.length, errors } });
    }

    return errRes(`Ação inválida: '${action}'. Use: ${VALID_ACTIONS.join(", ")}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno do servidor";
    log("error", "unhandled", message, { rid: requestId, stack: error instanceof Error ? error.stack : undefined });
    return errRes(translateError(message), 500);
  }
});
