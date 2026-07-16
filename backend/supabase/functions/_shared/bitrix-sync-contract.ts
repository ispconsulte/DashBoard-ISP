export type BitrixSyncOutcome =
  | "success"
  | "noop"
  | "already_running"
  | "partial_success"
  | "bitrix_unavailable"
  | "authentication_failure"
  | "timeout"
  | "internal_failure";

const KNOWN_OUTCOMES = new Set<BitrixSyncOutcome>([
  "success",
  "noop",
  "already_running",
  "partial_success",
  "bitrix_unavailable",
  "authentication_failure",
  "timeout",
  "internal_failure",
]);

export function classifyBitrixFailure(error: unknown) {
  const originalMessage = error instanceof Error ? error.message : String(error ?? "Erro inesperado.");
  const normalized = `${error instanceof Error ? error.name : ""} ${originalMessage}`.toLowerCase();
  const isBitrixFailure = normalized.includes("bitrix");

  if (/\b504\b|\b546\b|worker_resource_limit|timeout|timed out|aborterror|tempo limite/.test(normalized)) {
    return { status: 504, outcome: "timeout" as const, message: "A atualização excedeu o tempo limite." };
  }
  if (isBitrixFailure && /\b401\b|\b403\b|unauthori[sz]ed|forbidden|access denied|permission|acesso negado|sem permiss|invalid.credentials|invalid.webhook/.test(normalized)) {
    return { status: 502, outcome: "authentication_failure" as const, message: "O Bitrix recusou a autenticação ou permissão." };
  }
  if (isBitrixFailure && /\b429\b|\b50[0-9]\b|fetch failed|network|indispon|temporarily unavailable/.test(normalized)) {
    return { status: 503, outcome: "bitrix_unavailable" as const, message: "O Bitrix está indisponível no momento." };
  }
  return { status: 500, outcome: "internal_failure" as const, message: originalMessage };
}

export function normalizeBitrixWorkerResult(
  status: number,
  ok: boolean,
  data: Record<string, unknown> | null,
) {
  const rawOutcome = String(data?.outcome ?? "") as BitrixSyncOutcome;
  const explicitOutcome = KNOWN_OUTCOMES.has(rawOutcome) ? rawOutcome : null;

  if (ok && data?.success !== false) {
    const outcome = explicitOutcome
      ?? (data?.skipped ? "already_running" : "success");
    return { status, ok: true, outcome, error: null };
  }

  const rawError = data?.error ?? data?.message ?? `HTTP ${status}`;
  const failure = classifyBitrixFailure(`Bitrix ${status === 546 ? `HTTP 546 ${String(rawError)}` : String(rawError)}`);
  return {
    status: status === 546 ? 504 : failure.status,
    ok: false,
    outcome: explicitOutcome ?? failure.outcome,
    error: failure.message,
  };
}
