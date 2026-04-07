import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { storage } from "@/modules/shared/storage";
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseExt } from "@/lib/supabase";
import {
  fetchUserRole,
  fetchAllowedAreas,
  fetchAccessibleProjects,
  fetchClienteInfo,
  fetchUserName,
  fetchBonusUserContext,
} from "@/modules/auth/api/fetchAuthData";
import type { BonusPermissionRole, BonusSeniority } from "@/modules/sprint6/bonusEvaluation";

/** Sync auth session to the supabaseExt client so Realtime/Presence works */
const syncSupabaseSession = async (accessToken: string, refreshToken?: string) => {
  if (!accessToken) return;
  await supabaseExt.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken ?? "",
  }).catch(() => { /* best-effort */ });
};

export type UserRole = "admin" | "consultor" | "gerente" | "coordenador" | "cliente";
export type AccessArea = "home" | "comodato" | "integracoes" | "tarefas" | "usuarios" | "analiticas" | "calendario" | "gamificacao" | "ferramentas" | "suporte" | "sprint" | "bonificacao" | "clientes" | "diagnostico";

export type AuthSession = {
  userId?: string | null;
  authUserId?: string | null;
  name: string;
  email: string;
  role: UserRole;
  bonusRole?: BonusPermissionRole;
  seniority?: BonusSeniority;
  bitrixUserId?: string | null;
  coordinatorOf?: string[];
  myCoordinator?: string | null;
  company?: string | null;
  clienteId?: number | null;
  allowedAreas?: AccessArea[] | null;
  accessibleProjectIds?: number[] | null;
  accessibleProjectNames?: string[] | null;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
};

type AuthPayload = {
  name?: string;
  email: string;
  password: string;
  role?: UserRole;
  adminCode?: string;
  company?: string;
};

type AuthResult = {
  success: boolean;
  message?: string;
};

export const ACCESS_RULES: Record<UserRole, Record<AccessArea, boolean>> = {
  admin: { home: true, comodato: true, integracoes: true, tarefas: true, usuarios: true, analiticas: true, calendario: true, gamificacao: true, ferramentas: true, suporte: true, sprint: true, bonificacao: true, clientes: true, diagnostico: true },
  gerente: { home: true, comodato: true, integracoes: true, tarefas: true, usuarios: true, analiticas: true, calendario: true, gamificacao: true, ferramentas: true, suporte: true, sprint: true, bonificacao: true, clientes: true, diagnostico: false },
  coordenador: { home: true, comodato: true, integracoes: true, tarefas: true, usuarios: true, analiticas: true, calendario: true, gamificacao: true, ferramentas: true, suporte: true, sprint: true, bonificacao: true, clientes: true, diagnostico: false },
  consultor: { home: true, comodato: false, integracoes: false, tarefas: true, usuarios: false, analiticas: false, calendario: true, gamificacao: true, ferramentas: true, suporte: true, sprint: false, bonificacao: false, clientes: false, diagnostico: false },
  cliente: { home: true, comodato: false, integracoes: false, tarefas: true, usuarios: false, analiticas: false, calendario: false, gamificacao: false, ferramentas: false, suporte: true, sprint: false, bonificacao: false, clientes: true, diagnostico: false },
};

const SESSION_KEY = "auth_session";
const AUTH_SESSION_EVENT = "auth-session-changed";

const readStoredSession = () => storage.get<AuthSession | null>(SESSION_KEY, null);

type AuthStoreSnapshot = {
  session: AuthSession | null;
  loading: boolean;
};

let authStore: AuthStoreSnapshot = {
  session: readStoredSession(),
  loading: !readStoredSession(),
};

let authBootstrapPromise: Promise<void> | null = null;
const authListeners = new Set<(snapshot: AuthStoreSnapshot) => void>();

function emitAuthStore() {
  authListeners.forEach((listener) => listener(authStore));
}

function setAuthStore(next: Partial<AuthStoreSnapshot>) {
  authStore = {
    ...authStore,
    ...next,
  };
  emitAuthStore();
}

/** Build a full session from Supabase auth response data */
const buildSession = async (
  data: Record<string, any>,
  fallbackEmail: string,
  storedSession?: AuthSession | null
): Promise<AuthSession> => {
  const user = data?.user;
  const metadata = user?.user_metadata ?? {};
  const metaObj = metadata as Record<string, unknown>;
  const clientName = metaObj?.["client_name"] as string | undefined;
  const expiresIn = Number(data?.expires_in ?? 0);
  const expiresAt = Date.now() + expiresIn * 1000;

  const [role, allowedAreas, accessibleProjects, clienteInfo, dbName, bonusContext] = await Promise.all([
    fetchUserRole(data?.access_token, user?.id, metaObj),
    fetchAllowedAreas(data?.access_token, user?.id),
    fetchAccessibleProjects(data?.access_token, user?.id),
    fetchClienteInfo(data?.access_token, user?.id),
    fetchUserName(data?.access_token, user?.id),
    fetchBonusUserContext(data?.access_token, user?.id),
  ]);

  return {
    userId: bonusContext.userId,
    authUserId: bonusContext.authUserId ?? user?.id ?? null,
    name: dbName || metadata.name || user?.email || storedSession?.name || "Usuário",
    email: user?.email ?? fallbackEmail,
    role,
    bonusRole: bonusContext.bonusRole,
    seniority: bonusContext.seniority,
    bitrixUserId: bonusContext.bitrixUserId,
    coordinatorOf: bonusContext.coordinatorOf,
    myCoordinator: bonusContext.myCoordinator,
    company: clienteInfo.clienteName ?? clientName ?? storedSession?.company ?? null,
    clienteId: clienteInfo.clienteId ?? storedSession?.clienteId ?? null,
    allowedAreas,
    accessibleProjectIds: accessibleProjects?.ids ?? null,
    accessibleProjectNames: accessibleProjects?.names ?? null,
    accessToken: data?.access_token,
    refreshToken: data?.refresh_token ?? storedSession?.refreshToken,
    expiresAt,
  };
};

export function useAuth() {
  const [session, setSession] = useState<AuthSession | null>(authStore.session);
  const [loadingSession, setLoadingSession] = useState(authStore.loading);
  const loginAttemptRef = useRef(0);
  const loginSpamCountRef = useRef(0);
  const loginBlockedUntilRef = useRef(0);
  const failedAttemptsRef = useRef(0);
  const failedBlockedUntilRef = useRef(0);

  const persistSession = useCallback((data: AuthSession | null) => {
    if (data) storage.set(SESSION_KEY, data);
    else storage.remove(SESSION_KEY);
    setAuthStore({ session: data });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent<AuthSession | null>(AUTH_SESSION_EVENT, { detail: data }));
    }
  }, []);

  const clearSession = useCallback(() => {
    persistSession(null);
    setSession(null);
    setAuthStore({ session: null, loading: false });
  }, [persistSession]);

  const refreshSession = useCallback(
    async (stored: AuthSession, attempt = 0): Promise<AuthSession | null> => {
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !stored.refreshToken) return null;
      try {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
          method: "POST",
          headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: stored.refreshToken }),
        });
        const data = await response.json();
        if (!response.ok) {
          const reason = String(data?.msg ?? data?.error_description ?? data?.error ?? "");
          if (reason.toLowerCase().includes("refresh token") || response.status === 400 || response.status === 401 || response.status === 403) {
            console.warn("[auth] Invalid refresh token, clearing session");
            clearSession();
            return null;
          }
          return null;
        }

        // IMPORTANT: Always rebuild full session from DB (including project names)
        // so that admin changes to project access take effect on next token refresh.
        const refreshed = await buildSession(data, stored.email, stored);
        setSession(refreshed);
        persistSession(refreshed);
        await syncSupabaseSession(data.access_token, data.refresh_token);
        return refreshed;
      } catch (err) {
        if (attempt < 1) {
          await new Promise((r) => setTimeout(r, 2000));
          return refreshSession(stored, attempt + 1);
        }
        console.warn("[auth] Token refresh failed after retry", err);
        return null;
      }
    },
    [persistSession, clearSession]
  );

  // ── Initial session restore ──
  useEffect(() => {
    const handleAuthSnapshot = (snapshot: AuthStoreSnapshot) => {
      setSession(snapshot.session);
      setLoadingSession(snapshot.loading);
    };

    authListeners.add(handleAuthSnapshot);

    setSession(authStore.session);
    setLoadingSession(authStore.loading);

    const load = async () => {
      const saved = readStoredSession();
      if (saved?.accessToken) {
        setAuthStore({ session: saved, loading: false });

        const expired = saved.expiresAt ? saved.expiresAt < Date.now() : false;
        if (expired && saved.refreshToken) {
          const refreshed = await refreshSession(saved);
          if (refreshed) return;
          clearSession();
          return;
        }

        await syncSupabaseSession(saved.accessToken!, saved.refreshToken);

        if (saved.accessToken && saved.email) {
          try {
            const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
              headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${saved.accessToken}` },
            });

            if (!userRes.ok) {
              console.warn("[auth] Token invalid (status", userRes.status, "), attempting refresh…");
              if (saved.refreshToken) {
                const refreshed = await refreshSession(saved);
                if (refreshed) return;
              }
              console.warn("[auth] Refresh failed, clearing session");
              clearSession();
              return;
            }

            const userData = await userRes.json();
            const userId = userData?.id;
            if (userId) {
              const [accessibleProjects, clienteInfo, dbName, bonusContext] = await Promise.all([
                fetchAccessibleProjects(saved.accessToken, userId),
                fetchClienteInfo(saved.accessToken, userId),
                fetchUserName(saved.accessToken, userId),
                fetchBonusUserContext(saved.accessToken, userId),
              ]);
              const updated: AuthSession = {
                ...saved,
                userId: bonusContext.userId,
                authUserId: bonusContext.authUserId ?? userId,
                name: dbName || saved.name,
                bonusRole: bonusContext.bonusRole,
                seniority: bonusContext.seniority,
                bitrixUserId: bonusContext.bitrixUserId,
                coordinatorOf: bonusContext.coordinatorOf,
                myCoordinator: bonusContext.myCoordinator,
                accessibleProjectIds: accessibleProjects?.ids ?? null,
                accessibleProjectNames: accessibleProjects?.names ?? null,
                company: clienteInfo.clienteName ?? saved.company ?? null,
                clienteId: clienteInfo.clienteId ?? saved.clienteId ?? null,
              };
              setSession(updated);
              persistSession(updated);
            }
          } catch {
            // Network error — keep cached session
          }
        }
        return;
      } else {
        storage.remove(SESSION_KEY);
        setAuthStore({ session: null, loading: false });
      }
    };

    if (!authBootstrapPromise) {
      authBootstrapPromise = load().finally(() => {
        setAuthStore({ loading: false });
      });
    }

    void authBootstrapPromise;

    return () => {
      authListeners.delete(handleAuthSnapshot);
    };
  }, [refreshSession, persistSession, clearSession]);

  useEffect(() => {
    const handleSessionChanged = (event: Event) => {
      const next = (event as CustomEvent<AuthSession | null>).detail ?? readStoredSession();
      setAuthStore({ session: next, loading: false });
    };

    window.addEventListener(AUTH_SESSION_EVENT, handleSessionChanged as EventListener);
    return () => {
      window.removeEventListener(AUTH_SESSION_EVENT, handleSessionChanged as EventListener);
    };
  }, []);

  // ── Proactive token refresh timer ──
  // Refreshes the JWT ~2 minutes before it expires so the user never sees
  // "session expired" errors during normal usage.
  useEffect(() => {
    const REFRESH_MARGIN_MS = 2 * 60 * 1000; // refresh 2 min before expiry
    const MIN_INTERVAL_MS = 30_000; // never poll faster than 30s

    const tick = async () => {
      const current = storage.get<AuthSession | null>(SESSION_KEY, null);
      if (!current?.refreshToken || !current?.expiresAt) return;

      const msUntilExpiry = current.expiresAt - Date.now();
      if (msUntilExpiry <= REFRESH_MARGIN_MS) {
        console.info("[auth] Proactive token refresh (expires in", Math.round(msUntilExpiry / 1000), "s)");
        const refreshed = await refreshSession(current);
        if (!refreshed && msUntilExpiry <= 0) {
          clearSession();
        }
      }
    };

    // Check every 60s whether we need to refresh
    const id = setInterval(tick, Math.max(MIN_INTERVAL_MS, 60_000));
    // Also run immediately in case we loaded with a nearly-expired token
    void tick();

    return () => clearInterval(id);
  }, [refreshSession, clearSession]);

  const login = useCallback(
    async ({ email, password }: AuthPayload): Promise<AuthResult> => {
      const now = Date.now();

      if (now < failedBlockedUntilRef.current) {
        const seconds = Math.ceil((failedBlockedUntilRef.current - now) / 1000);
        return { success: false, message: `Conta bloqueada temporariamente após 3 tentativas incorretas. Aguarde ${seconds}s ou entre em contato com seu consultor para recuperar a senha.` };
      }
      if (now < loginBlockedUntilRef.current) {
        const seconds = Math.ceil((loginBlockedUntilRef.current - now) / 1000);
        return { success: false, message: `Aguarde ${seconds}s antes de tentar novamente.` };
      }
      if (now - loginAttemptRef.current < 1500) {
        loginSpamCountRef.current += 1;
        if (loginSpamCountRef.current >= 3) {
          loginBlockedUntilRef.current = now + 15000;
          loginSpamCountRef.current = 0;
          return { success: false, message: "Você está clicando rápido demais. Aguarde um instante." };
        }
        return { success: false, message: "Aguarde um instante entre tentativas." };
      }
      loginAttemptRef.current = now;

      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        return { success: false, message: "Conexão com o servidor não configurada." };
      }

      try {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
          method: "POST",
          headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await response.json();
        if (!response.ok) {
          failedAttemptsRef.current += 1;
          if (failedAttemptsRef.current >= 3) {
            failedBlockedUntilRef.current = Date.now() + 60_000;
            failedAttemptsRef.current = 0;
            return { success: false, message: "Conta bloqueada por 60 segundos após 3 tentativas incorretas. Entre em contato com seu consultor para recuperar a senha." };
          }
          const remaining = 3 - failedAttemptsRef.current;
          const msg = data?.msg || data?.error_description || data?.error || "Credenciais inválidas.";
          return { success: false, message: `${msg} (${remaining} tentativa${remaining > 1 ? "s" : ""} restante${remaining > 1 ? "s" : ""})` };
        }

        const authSession = await buildSession(data, email);
        setAuthStore({ session: authSession, loading: false });
        persistSession(authSession);
        await syncSupabaseSession(data.access_token, data.refresh_token);
        loginSpamCountRef.current = 0;
        loginBlockedUntilRef.current = 0;
        failedAttemptsRef.current = 0;
        failedBlockedUntilRef.current = 0;
        return { success: true };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Falha ao autenticar.";
        return { success: false, message: msg };
      }
    },
    [persistSession]
  );

  const register = useCallback(async (): Promise<AuthResult> => {
    return { success: false, message: "Cadastro desabilitado. Peça a um admin." };
  }, []);

  const logout = useCallback(async () => {
    if (session?.accessToken) {
      try {
        const base = SUPABASE_URL.replace(/\/$/, "");
        await fetch(`${base}/auth/v1/logout`, {
          method: "POST",
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" },
        });
      } catch { /* best-effort */ }
    }
    supabaseExt.auth.signOut().catch(() => {});
    setAuthStore({ session: null, loading: false });
    persistSession(null);
  }, [session?.accessToken, persistSession]);

  const canAccess = useCallback(
    (area: AccessArea, roleOverride?: UserRole) => {
      const role = roleOverride ?? session?.role ?? "consultor";
      // Admin, gerente e coordenador têm acesso irrestrito a tudo,
      // independente de allowedAreas configurado manualmente no banco.
      if (role === "admin" || role === "gerente" || role === "coordenador") return true;
      const allowed = session?.allowedAreas;
      if (allowed && allowed.length > 0) return allowed.includes(area);
      const rules = ACCESS_RULES[role] ?? ACCESS_RULES.consultor;
      return Boolean(rules[area]);
    },
    [session?.role, session?.allowedAreas]
  );

  return useMemo(
    () => ({ session, loadingSession, isAuthenticated: Boolean(session), canAccess, login, register, logout }),
    [session, loadingSession, canAccess, login, register, logout]
  );
}
