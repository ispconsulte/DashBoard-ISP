import { useCallback, useEffect, useState } from "react";
import { supabaseRest, safeJson } from "./supabaseRest";
import { callManageUser } from "./manageUserApi";
import type { UserRow, ProjectRow, AuditRow, ClienteRow } from "../types";
import { normalizeBonusRole, normalizeBonusSeniority } from "@/modules/sprint6/bonusEvaluation";

export function useUsersApi(token: string | undefined) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Cache areas/projects per auth_user_id from the list response
  const [userAreasMap, setUserAreasMap] = useState<Map<string, string[]>>(new Map());
  const [userProjectsMap, setUserProjectsMap] = useState<Map<string, number[]>>(new Map());

  const loadUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await callManageUser(token, { action: "list" });
      const data = result.data;
      if (Array.isArray(data)) {
        const areasMap = new Map<string, string[]>();
        const projMap = new Map<string, number[]>();
        setUsers(data.map((u: Record<string, unknown>) => {
          const authUid = String(u.auth_user_id ?? "");
          if (Array.isArray(u.areas)) areasMap.set(authUid, u.areas as string[]);
          if (Array.isArray(u.projects)) projMap.set(authUid, u.projects as number[]);
          return {
            id: String(u.id ?? ""),
            auth_user_id: authUid,
            email: String(u.email ?? ""),
            name: String(u.name ?? ""),
            user_profile: String(u.user_profile ?? "Consultor"),
            active: u.active !== false,
            role: u.role ? String(u.role) : undefined,
            bonus_role: normalizeBonusRole(String(u.bonus_role ?? u.role ?? u.user_profile ?? "")),
            seniority: normalizeBonusSeniority(String(u.seniority ?? "")),
            subordinate_ids: Array.isArray(u.subordinate_ids) ? u.subordinate_ids.map((id) => String(id)) : [],
            my_coordinator: u.my_coordinator ? String(u.my_coordinator) : null,
            bitrix_user_id: u.bitrix_user_id ? String(u.bitrix_user_id) : null,
            cliente_id: u.cliente_id != null ? Number(u.cliente_id) : null,
          };
        }));
        setUserAreasMap(areasMap);
        setUserProjectsMap(projMap);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar usuários.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadProjects = useCallback(async () => {
    if (!token) return;
    try {
      const res = await supabaseRest("projects?select=id,name,active&order=name.asc&limit=500", token);
      const data = await safeJson(res);
      if (Array.isArray(data)) {
        setProjects(data.map((p: Record<string, unknown>) => ({
          id: Number(p.id),
          name: String(p.name ?? ""),
          active: p.active !== false,
        })));
      }
    } catch {
      // non-critical
    }
  }, [token]);

  const loadClientes = useCallback(async () => {
    if (!token) return;
    try {
      const res = await supabaseRest('clientes?select=cliente_id,nome,"Ativo"&order=nome.asc&limit=500', token);
      const data = await safeJson(res);
      if (Array.isArray(data)) {
        setClientes(data.map((c: Record<string, unknown>) => ({
          cliente_id: Number(c.cliente_id),
          nome: String(c.nome ?? ""),
          Ativo: c.Ativo !== false,
        })));
      }
    } catch {
      // non-critical
    }
  }, [token]);

  const saveUser = useCallback(async (
    userId: string,
    authUserId: string,
    payload: Partial<UserRow>,
    selectedAreas: string[],
    selectedProjects: number[],
    performedBy: string,
  ) => {
    if (!token) throw new Error("Sem token");

    // Use edge function with service_role to bypass RESTRICTIVE RLS
    await callManageUser(token, {
      action: "update",
      userId,
      authUserId,
      payload: {
        name: payload.name,
        email: payload.email,
        user_profile: payload.user_profile,
        active: payload.active,
        seniority: payload.seniority,
        role: payload.bonus_role,
        bitrix_user_id: payload.bitrix_user_id,
      },
      areas: selectedAreas,
      projects: selectedProjects,
    });
  }, [token]);

  const deleteUser = useCallback(async (userId: string, authUserId: string, performedBy: string) => {
    if (!token) throw new Error("Sem token");
    await callManageUser(token, { action: "delete", authUserId });
  }, [token]);

  const getUserAreas = useCallback(async (authUserId: string): Promise<string[]> => {
    return userAreasMap.get(authUserId) ?? [];
  }, [userAreasMap]);

  const getUserProjects = useCallback(async (authUserId: string): Promise<number[]> => {
    return userProjectsMap.get(authUserId) ?? [];
  }, [userProjectsMap]);

  const getAuditLog = useCallback(async (): Promise<AuditRow[]> => {
    if (!token) return [];
    try {
      const res = await supabaseRest("audit_log?select=*&order=created_at.desc&limit=100", token);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  }, [token]);

  useEffect(() => {
    if (token) {
      Promise.all([loadUsers(), loadProjects(), loadClientes()]);
    }
  }, [token, loadUsers, loadProjects, loadClientes]);

  return {
    users, projects, clientes, loading, error,
    loadUsers, loadProjects, loadClientes,
    saveUser, deleteUser,
    getUserAreas, getUserProjects, getAuditLog,
  };
}
