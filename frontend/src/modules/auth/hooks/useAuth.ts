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
  gerente: { home: true, comodato: true, integracoes: true, tarefas: true, usuarios: true, analiticas: true, calendario: true, gamificacao: true, ferramentas: true, suporte: true, sprint: true, bonificacao: true, clientes: true, diagnostico: true },
  coordenador: { home: true, comodato: true, integracoes: true, tarefas: true, usuarios: true, analiticas: true, calendario: true, gamificacao: true, ferramentas: true, suporte: true, sprint: true, bonificacao: true, clientes: true, diagnostico: true },
  consultor: { home: true, comodato: false, integracoes: false, tarefas: true, usuarios: false, analiticas: false, calendario: true, gamificacao: true, ferramentas: true, suporte: true, sprint: false, bonificacao: false, clientes: false, diagnostico: false },
  cliente: { home: true, comodato: false, integracoes: false, tarefas: true, usuarios: false, analiticas: false, calendario: false, gamificacao: false, ferramentas: false, suporte: true, sprint: false, bonificacao: false, clientes: true, diagnostico: false },
};

const SESSION_KEY = "auth_session";
const AUTH_SESSION_EVENT = "auth-session-changed";

/**
 * Read stored session metadata from localStorage.
 * Tokens are NOT stored here — they are managed by the Supabase SDK.
 */
const readStoredSession = () => storage.get<AuthSession | null>(SESSION_KEY, null);

type AuthStoreSnapshot = {
  session: AuthSession | null;
  loading: boolean;
};

const initialStored = readStoredSession();

let authStore: AuthStoreSnapshot = {
  session: initialStored,
  // If we have stored metadata but no accessToken, we still need to hydrate
  // tokens from the SDK — keep loading=true until load() completes.
  loading: !initialStored || !initialStored.accessToken,
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

/**
 * Get the current access token from the Supabase SDK session.
 * This avoids reading tokens from localStorage directly.
 */
async function getSDKAccessToken(): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    const { data } = await supabaseExt.auth.getSession();
    if (data?.session?.access_token) {
      return {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token ?? "",
      };
    }
  } catch { /* ignore */ }
  return null;
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

  /**
   * Persist session metadata to localStorage WITHOUT tokens.
   * Tokens are managed exclusively by the Supabase SDK.
   */
  const persistSession = useCallback((data: AuthSession | null) => {
    if (data) {
      // Strip tokens — SDK handles token persistence in its own storage keys
      const { accessToken: _at, refreshToken: _rt, ...metadata } = data;
      storage.set(SESSION_KEY, metadata);
    } else {
      storage.remove(SESSION_KEY);
    }
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
      try {
        // Use SDK to refresh the session — it manages tokens internally
        const { data, error } = await supabaseExt.auth.refreshSession();
        if (error || !data?.session) {
          const reason = error?.message ?? "";
          if (reason.toLowerCase().includes("refresh token") || reason.toLowerCase().includes("invalid")) {
            console.warn("[auth] Invalid refresh token, clearing session");
            clearSession();
            return null;
          }
          if (attempt < 1) {
            await new Promise((r) => setTimeout(r, 2000));
            return refreshSession(stored, attempt + 1);
          }
          clearSession();
          return null;
        }

        const sess = data.session;
        const refreshed = await buildSession(
          {
            access_token: sess.access_token,
            refresh_token: sess.refresh_token,
            user: sess.user,
            expires_in: sess.expires_in,
          },
          stored.email,
          stored,
        );
        setSession(refreshed);
        persistSession(refreshed);
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

      // Get tokens from the Supabase SDK (persisted in its own storage)
      const sdkTokens = await getSDKAccessToken();

      // Migration: if saved session has legacy tokens but SDK doesn't, seed the SDK
      if (!sdkTokens && saved?.accessToken && saved?.refreshToken) {
        await syncSupabaseSession(saved.accessToken, saved.refreshToken);
        // Re-read SDK after seeding
        const seeded = await getSDKAccessToken();
        if (seeded) {
          // Strip legacy tokens from our storage and continue
          const merged: AuthSession = { ...saved, accessToken: seeded.accessToken, refreshToken: seeded.refreshToken };
          persistSession(merged); // Will strip tokens from localStorage
          setAuthStore({ session: merged, loading: false });

          // Validate and hydrate
          await hydrateSession(merged);
          return;
        }
      }

      if (sdkTokens && saved) {
        // Merge SDK tokens with stored metadata
        const merged: AuthSession = { ...saved, accessToken: sdkTokens.accessToken, refreshToken: sdkTokens.refreshToken };
        setAuthStore({ session: merged, loading: false });

        // Check if SDK session is expired and needs full rebuild
        const expired = saved.expiresAt ? saved.expiresAt < Date.now() : false;
        if (expired) {
          const refreshed = await refreshSession(merged);
          if (refreshed) return;
          clearSession();
          return;
        }

        await hydrateSession(merged);
        return;
      }

      if (sdkTokens && !saved) {
        // SDK has a session but we have no metadata — rebuild everything
        try {
          const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${sdkTokens.accessToken}` },
          });
          if (userRes.ok) {
            const userData = await userRes.json();
            const fullSession = await buildSession(
              { access_token: sdkTokens.accessToken, refresh_token: sdkTokens.refreshToken, user: userData, expires_in: 3600 },
              userData?.email ?? "",
            );
            setSession(fullSession);
            persistSession(fullSession);
            setAuthStore({ session: fullSession, loading: false });
            return;
          }
        } catch { /* fall through */ }
      }

      // No valid session anywhere
      storage.remove(SESSION_KEY);
      setAuthStore({ session: null, loading: false });
    };

    /** Validate token and hydrate session metadata from DB */
    async function hydrateSession(merged: AuthSession) {
      if (!merged.accessToken || !merged.email) return;
      try {
        const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${merged.accessToken}` },
        });

        if (!userRes.ok) {
          console.warn("[auth] Token invalid (status", userRes.status, "), attempting refresh…");
          const refreshed = await refreshSession(merged);
          if (refreshed) return;
          console.warn("[auth] Refresh failed, clearing session");
          clearSession();
          return;
        }

        const userData = await userRes.json();
        const userId = userData?.id;
        if (userId) {
          const [accessibleProjects, clienteInfo, dbName, bonusContext] = await Promise.all([
            fetchAccessibleProjects(merged.accessToken, userId),
            fetchClienteInfo(merged.accessToken, userId),
            fetchUserName(merged.accessToken, userId),
            fetchBonusUserContext(merged.accessToken, userId),
          ]);
          const updated: AuthSession = {
            ...merged,
            userId: bonusContext.userId,
            authUserId: bonusContext.authUserId ?? userId,
            name: dbName || merged.name,
            bonusRole: bonusContext.bonusRole,
            seniority: bonusContext.seniority,
            bitrixUserId: bonusContext.bitrixUserId,
            coordinatorOf: bonusContext.coordinatorOf,
            myCoordinator: bonusContext.myCoordinator,
            accessibleProjectIds: accessibleProjects?.ids ?? null,
            accessibleProjectNames: accessibleProjects?.names ?? null,
            company: clienteInfo.clienteName ?? merged.company ?? null,
            clienteId: clienteInfo.clienteId ?? merged.clienteId ?? null,
          };
          setSession(updated);
          persistSession(updated);
        }
      } catch {
        // Network error — keep cached session
      }
    }

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
  useEffect(() => {
    const REFRESH_MARGIN_MS = 2 * 60 * 1000;
    const MIN_INTERVAL_MS = 30_000;

    const tick = async () => {
      const current = storage.get<AuthSession | null>(SESSION_KEY, null);
      if (!current?.expiresAt) return;

      // Get tokens from SDK — not from our custom storage
      const sdkTokens = await getSDKAccessToken();
      if (!sdkTokens) return;

      const msUntilExpiry = current.expiresAt - Date.now();
      if (msUntilExpiry <= REFRESH_MARGIN_MS) {
        console.info("[auth] Proactive token refresh (expires in", Math.round(msUntilExpiry / 1000), "s)");
        const merged = { ...current, accessToken: sdkTokens.accessToken, refreshToken: sdkTokens.refreshToken };
        const refreshed = await refreshSession(merged);
        if (!refreshed && msUntilExpiry <= 0) {
          clearSession();
        }
      }
    };

    const id = setInterval(tick, Math.max(MIN_INTERVAL_MS, 60_000));
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
        // Sync to SDK so it persists tokens in its own storage
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

    // Clear cached data to prevent leakage to the next user on the same device
    const cacheKeys = storage.keys("cache:");
    cacheKeys.forEach((key) => storage.remove(key));
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
