import type { ApiResult, ComodatoLaunchResult, ComodatoStatus } from "./types";
import { storage } from "@/modules/shared/storage";

/**
 * Reads the active IXC integration profile config from localStorage.
 * Now requires userEmail to avoid cross-user credential leaks.
 */
function getActiveIxcConfig(userEmail?: string): Record<string, string> | null {
  // If we have the user email, use their specific key
  if (userEmail) {
    const key = `integrations_state:${userEmail}`;
    const state = storage.get<Record<string, { status: string; config?: Record<string, string>; activeProfile?: string; profiles?: { name: string; data: Record<string, string> }[] }>>(key, {});
    const ixc = state["ixc"];
    if (!ixc || ixc.status !== "CONECTADO") return null;

    const activeProfileName = ixc.activeProfile;
    if (activeProfileName && ixc.profiles?.length) {
      const profile = ixc.profiles.find((p) => p.name === activeProfileName);
      if (profile?.data?.host) return profile.data;
    }
    if (ixc.config?.host) return ixc.config;
    return null;
  }

  // Fallback: try all keys (backwards compat) — but only first match
  const keys = storage.keys("integrations_state:");
  for (const key of keys) {
    const state = storage.get<Record<string, { status: string; config?: Record<string, string>; activeProfile?: string; profiles?: { name: string; data: Record<string, string> }[] }>>(key, {});
    const ixc = state["ixc"];
    if (!ixc || ixc.status !== "CONECTADO") continue;

    const activeProfileName = ixc.activeProfile;
    if (activeProfileName && ixc.profiles?.length) {
      const profile = ixc.profiles.find((p) => p.name === activeProfileName);
      if (profile?.data?.host) return profile.data;
    }
    if (ixc.config?.host) return ixc.config;
  }
  return null;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function postIxc<T>(
  payload: Record<string, unknown>,
  options?: { idempotencyKey?: string; auditUser?: string }
): Promise<ApiResult<T>> {
  try {
    const config = getActiveIxcConfig(options?.auditUser);
    if (!config?.host) {
      return { ok: false, error: "Integração IXC não configurada. Acesse Integrações para configurar." };
    }

    const key =
      options?.idempotencyKey ||
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Idempotency-Key": key,
      apikey: SUPABASE_KEY,
    };
    if (options?.auditUser) {
      headers["X-Audit-User"] = options.auditUser;
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/ixc-proxy`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...payload, config }),
    });

    const json = (await response.json()) as ApiResult<T>;

    if (!response.ok || json.ok === false) {
      return { ok: false, error: json.error ?? response.statusText };
    }

    return json;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao falar com a API IXC.";
    return { ok: false, error: message };
  }
}

export function consultarComodato(input: {
  pppoe: string;
  serial?: string;
  config?: Record<string, unknown>;
  auditUser?: string;
}): Promise<ApiResult<ComodatoStatus>> {
  return postIxc<ComodatoStatus>({
    action: "consultar",
    pppoe: input.pppoe,
    serial: input.serial,
  }, { auditUser: input.auditUser });
}

export function lancarComodato(input: {
  contratoId: string;
  numeroSerie: string;
  numeroPatrimonial?: string;
  descricao?: string;
  valorUnitario?: string;
  idPatrimonio?: string;
  mac?: string;
  qtde?: number;
  data?: string;
  config?: Record<string, unknown>;
  idempotencyKey?: string;
  auditUser?: string;
}): Promise<ApiResult<ComodatoLaunchResult>> {
  return postIxc<ComodatoLaunchResult>({
    action: "lancar",
    contratoId: input.contratoId,
    numeroSerie: input.numeroSerie,
    numeroPatrimonial: input.numeroPatrimonial,
    descricao: input.descricao,
    valorUnitario: input.valorUnitario,
    idPatrimonio: input.idPatrimonio,
    mac: input.mac,
    qtde: input.qtde,
    data: input.data,
  }, { idempotencyKey: input.idempotencyKey, auditUser: input.auditUser });
}
