/**
 * Frontend helper to call the manage-user edge function.
 * All user management writes go through this function,
 * which uses service_role on the server to bypass RLS.
 */
const CLOUD_URL = import.meta.env.VITE_SUPABASE_URL as string;
const EDGE_FN_URL = `${CLOUD_URL}/functions/v1/manage-user`;

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const RETRY_DELAYS = [1000, 3000]; // 1s, 3s

type ManageUserResult = { ok: boolean; data?: unknown; error?: string; warnings?: string[] };

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function callManageUser(
  token: string,
  body: Record<string, unknown>,
): Promise<ManageUserResult> {
  const action = body.action ?? "unknown";
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Only retry safe/idempotent reads
    if (attempt > 0) {
      if (action !== "list") break; // Don't retry mutations
      const delay = RETRY_DELAYS[Math.min(attempt - 1, RETRY_DELAYS.length - 1)];
      await new Promise((r) => setTimeout(r, delay));
    }

    try {
      const res = await fetchWithTimeout(
        EDGE_FN_URL,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        },
        DEFAULT_TIMEOUT_MS,
      );

      const json = await res.json();

      if (!res.ok || json.ok === false) {
        const errMsg = json.error || `HTTP ${res.status}`;
        // Retry on 5xx for safe actions
        if (res.status >= 500 && action === "list" && attempt < MAX_RETRIES) {
          lastError = new Error(errMsg);
          continue;
        }
        throw new Error(errMsg);
      }

      return json;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        lastError = new Error("Tempo limite da requisição excedido. Tente novamente.");
      } else {
        lastError = err instanceof Error ? err : new Error(String(err));
      }

      if (action !== "list" || attempt >= MAX_RETRIES) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error("Falha inesperada na comunicação com o servidor.");
}
