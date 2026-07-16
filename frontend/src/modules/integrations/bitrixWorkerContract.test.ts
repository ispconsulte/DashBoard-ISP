import { describe, expect, it } from "vitest";
import {
  classifyBitrixFailure,
  normalizeBitrixWorkerResult,
} from "../../../../backend/supabase/functions/_shared/bitrix-sync-contract";

describe("contrato HTTP do worker Bitrix", () => {
  it.each([
    ["success", 200],
    ["noop", 200],
    ["already_running", 202],
    ["partial_success", 200],
  ] as const)("mantém %s como resultado válido", (outcome, status) => {
    const result = normalizeBitrixWorkerResult(status, true, { success: true, outcome });
    expect(result).toMatchObject({ ok: true, status, outcome, error: null });
  });

  it("substitui HTTP 546 por timeout HTTP 504", () => {
    expect(normalizeBitrixWorkerResult(546, false, { error: "WORKER_RESOURCE_LIMIT" })).toMatchObject({
      ok: false,
      status: 504,
      outcome: "timeout",
    });
  });

  it.each([
    ["Bitrix HTTP 403 Forbidden", 502, "authentication_failure"],
    ["Bitrix HTTP 503", 503, "bitrix_unavailable"],
    ["AbortError: timeout", 504, "timeout"],
    ["falha inesperada no banco", 500, "internal_failure"],
  ] as const)("normaliza falha %s", (message, status, outcome) => {
    expect(classifyBitrixFailure(new Error(message))).toMatchObject({ status, outcome });
  });
});
