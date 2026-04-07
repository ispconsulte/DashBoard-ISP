import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import type { UserRole, AccessArea } from "../hooks/useAuth";
import { normalizeBonusRole, normalizeBonusSeniority, type BonusPermissionRole, type BonusSeniority } from "@/modules/sprint6/bonusEvaluation";

const normalizeRole = (value?: string): UserRole => {
  const role = (value ?? "").toLowerCase();
  if (role === "admin" || role === "administrador") return "admin";
  if (role === "gestor") return "gerente";
  if (role === "gerente") return "gerente";
  if (role === "coordenador") return "coordenador";
  if (role === "cliente") return "cliente";
  return "consultor";
};

const base = () => SUPABASE_URL.replace(/\/$/, "");

const headers = (token: string) => ({
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${token}`,
});

export type BonusUserContext = {
  userId: string | null;
  authUserId: string | null;
  bonusRole: BonusPermissionRole;
  seniority: BonusSeniority;
  coordinatorOf: string[];
  myCoordinator: string | null;
  bitrixUserId: string | null;
};

/** Fetch role: user_roles → users.user_profile → JWT metadata fallback */
export const fetchUserRole = async (
  accessToken: string,
  authUserId: string,
  jwtMetadata?: Record<string, unknown>
): Promise<UserRole> => {
  // 1. Try user_roles table
  try {
    const res = await fetch(
      `${base()}/rest/v1/user_roles?user_id=eq.${authUserId}&select=role&limit=1`,
      { headers: headers(accessToken) }
    );
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0) {
        return normalizeRole(rows[0].role);
      }
    }
  } catch { /* fallback */ }

  // 2. Fallback: users.user_profile
  try {
    const res2 = await fetch(
      `${base()}/rest/v1/users?auth_user_id=eq.${authUserId}&select=user_profile,role&limit=1`,
      { headers: headers(accessToken) }
    );
    if (res2.ok) {
      const rows2 = await res2.json();
      if (Array.isArray(rows2) && rows2.length > 0) {
        return normalizeRole(rows2[0].role ?? rows2[0].user_profile);
      }
    }
  } catch { /* fallback */ }

  // 3. Fallback: JWT user_metadata
  if (jwtMetadata?.user_profile) {
    return normalizeRole(jwtMetadata.user_profile as string);
  }

  return "consultor";
};

/** Fetch allowed areas from user_allowed_areas table */
export const fetchAllowedAreas = async (
  accessToken: string,
  authUserId: string
): Promise<AccessArea[] | null> => {
  try {
    const res = await fetch(
      `${base()}/rest/v1/user_allowed_areas?user_id=eq.${authUserId}&select=area_name`,
      { headers: headers(accessToken) }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    if (Array.isArray(rows) && rows.length > 0) {
      return rows.map((r: { area_name: string }) => r.area_name as AccessArea);
    }
  } catch { /* fallback */ }
  return null;
};

/** Fetch accessible project IDs and names from user_project_access + projects tables */
export const fetchAccessibleProjects = async (
  accessToken: string,
  authUserId: string
): Promise<{ ids: number[]; names: string[] } | null> => {
  try {
    // Join user_project_access with projects to get names
    const res = await fetch(
      `${base()}/rest/v1/user_project_access?user_id=eq.${authUserId}&select=project_id,projects(id,name)`,
      { headers: headers(accessToken) }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    if (Array.isArray(rows) && rows.length > 0) {
      const ids: number[] = [];
      const names: string[] = [];
      rows.forEach((r: { project_id: number; projects?: { id: number; name: string } | null }) => {
        ids.push(r.project_id);
        if (r.projects?.name) names.push(r.projects.name);
      });
      return { ids, names };
    }
  } catch { /* fallback */ }
  return null;
};

/** Fetch the user's display name from the users table */
export const fetchUserName = async (
  accessToken: string,
  authUserId: string
): Promise<string | null> => {
  try {
    const res = await fetch(
      `${base()}/rest/v1/users?auth_user_id=eq.${authUserId}&select=name&limit=1`,
      { headers: headers(accessToken) }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    const name = rows?.[0]?.name;
    return name && name.trim() ? name.trim() : null;
  } catch {
    return null;
  }
};

/** Fetch cliente_id and client name from users + clientes tables */
export const fetchClienteInfo = async (
  accessToken: string,
  authUserId: string
): Promise<{ clienteId: number | null; clienteName: string | null }> => {
  try {
    const res = await fetch(
      `${base()}/rest/v1/users?auth_user_id=eq.${authUserId}&select=cliente_id&limit=1`,
      { headers: headers(accessToken) }
    );
    if (!res.ok) return { clienteId: null, clienteName: null };
    const rows = await res.json();
    const clienteId = rows?.[0]?.cliente_id ?? null;
    if (!clienteId) return { clienteId: null, clienteName: null };

    const res2 = await fetch(
      `${base()}/rest/v1/clientes?cliente_id=eq.${clienteId}&select=nome&limit=1`,
      { headers: headers(accessToken) }
    );
    if (!res2.ok) return { clienteId, clienteName: null };
    const rows2 = await res2.json();
    return { clienteId, clienteName: rows2?.[0]?.nome ?? null };
  } catch {
    return { clienteId: null, clienteName: null };
  }
};

export const fetchBonusUserContext = async (
  accessToken: string,
  authUserId: string,
): Promise<BonusUserContext> => {
  const fallback: BonusUserContext = {
    userId: null,
    authUserId,
    bonusRole: "consultor",
    seniority: null,
    coordinatorOf: [],
    myCoordinator: null,
    bitrixUserId: null,
  };

  try {
    let userRow: Record<string, unknown> | undefined;

    const userRes = await fetch(
      `${base()}/rest/v1/users?auth_user_id=eq.${authUserId}&select=id,role,seniority,bitrix_user_id&limit=1`,
      { headers: headers(accessToken) },
    );

    if (userRes.ok) {
      [userRow] = await userRes.json();
    } else {
      const legacyRes = await fetch(
        `${base()}/rest/v1/users?auth_user_id=eq.${authUserId}&select=id,user_profile,seniority_level,bitrix_user_id&limit=1`,
        { headers: headers(accessToken) },
      );
      if (!legacyRes.ok) return fallback;
      [userRow] = await legacyRes.json();
    }

    const userId =
      typeof userRow?.id === "string"
        ? userRow.id
        : typeof userRow?.id === "number"
        ? String(userRow.id)
        : null;
    const bonusRoleValue = userRow?.role ?? userRow?.user_profile;
    const seniorityValue = userRow?.seniority ?? userRow?.seniority_level;
    const bitrixUserId =
      typeof userRow?.bitrix_user_id === "string"
        ? userRow.bitrix_user_id
        : typeof userRow?.bitrix_user_id === "number"
        ? String(userRow.bitrix_user_id)
        : null;

    if (!userId) {
      return {
        ...fallback,
        authUserId,
        bonusRole: normalizeBonusRole(typeof bonusRoleValue === "string" ? bonusRoleValue : undefined),
        seniority: normalizeBonusSeniority(typeof seniorityValue === "string" ? seniorityValue : undefined),
        bitrixUserId,
      };
    }

    const [coordinatorRes, myCoordinatorRes] = await Promise.all([
      fetch(
        `${base()}/rest/v1/user_coordinator_links?coordinator_user_id=eq.${userId}&select=subordinate_user_id`,
        { headers: headers(accessToken) },
      ),
      fetch(
        `${base()}/rest/v1/user_coordinator_links?subordinate_user_id=eq.${userId}&select=coordinator_user_id&limit=1`,
        { headers: headers(accessToken) },
      ),
    ]);

    const coordinatorRows = coordinatorRes.ok ? await coordinatorRes.json() : [];
    const myCoordinatorRows = myCoordinatorRes.ok ? await myCoordinatorRes.json() : [];

    return {
      userId,
      authUserId,
      bonusRole: normalizeBonusRole(typeof bonusRoleValue === "string" ? bonusRoleValue : undefined),
      seniority: normalizeBonusSeniority(typeof seniorityValue === "string" ? seniorityValue : undefined),
      coordinatorOf: Array.isArray(coordinatorRows)
        ? coordinatorRows.map((row: { subordinate_user_id?: string }) => row.subordinate_user_id).filter((value: unknown): value is string => typeof value === "string")
        : [],
      myCoordinator: Array.isArray(myCoordinatorRows) && typeof myCoordinatorRows[0]?.coordinator_user_id === "string"
        ? myCoordinatorRows[0].coordinator_user_id
        : null,
      bitrixUserId,
    };
  } catch {
    return fallback;
  }
};
