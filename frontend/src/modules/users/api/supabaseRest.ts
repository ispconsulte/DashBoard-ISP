import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

export const safeJson = async (res: Response) => {
  const text = await res.text();
  try { return text ? JSON.parse(text) : null; } catch { return { raw: text }; }
};

const RETRY_DELAYS = [0, 1000, 3000]; // instant, 1s, 3s

export const supabaseRest = async (
  path: string,
  token: string,
  options: RequestInit = {},
  /** Number of retries for 5xx errors (default: 2) */
  maxRetries = 2,
) => {
  const base = SUPABASE_URL.replace(/\/$/, "");
  const url = `${base}/rest/v1/${path}`;
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
    ...(options.headers as Record<string, string> || {}),
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)];
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    }

    try {
      const res = await fetch(url, { ...options, headers });

      // Only retry on 5xx server errors for safe methods or all methods
      if (res.status >= 500 && attempt < maxRetries) {
        lastError = new Error(`HTTP ${res.status}`);
        continue;
      }

      if (!res.ok) {
        const data = await safeJson(res);
        throw new Error(data?.message ?? data?.error ?? `HTTP ${res.status}`);
      }
      return res;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Only retry on network errors or 5xx (already handled above)
      if (attempt < maxRetries && !(lastError.message.startsWith("HTTP 4"))) {
        continue;
      }
      throw lastError;
    }
  }

  throw lastError ?? new Error("Falha inesperada.");
};
