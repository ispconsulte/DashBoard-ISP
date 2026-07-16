import { describe, expect, it } from "vitest";
import { summarizeBitrixSyncJobs } from "./bitrixSyncOutcome";
import type { TriggerSyncPayload } from "@/modules/diagnostics/api/adminDiagnosticsApi";

type Job = TriggerSyncPayload["jobs"][number];

const job = (outcome: Job["outcome"], ok = true, error: string | null = null): Job => ({
  job_name: "Get-Projetcs-And-Tasks-Bitrix",
  status: ok ? 200 : 503,
  ok,
  outcome,
  data: { success: ok, outcome },
  error,
});

describe("summarizeBitrixSyncJobs", () => {
  it("classifica execução com atualizações", () => {
    expect(summarizeBitrixSyncJobs([job("success")]).kind).toBe("success");
  });

  it("trata ausência de pendências como resultado neutro", () => {
    expect(summarizeBitrixSyncJobs([job("noop"), { ...job("noop"), job_name: "sync-bitrix-times" }])).toEqual({
      kind: "noop",
      message: "Nenhuma atualização pendente no momento.",
    });
  });

  it("distingue execução duplicada e sucesso parcial", () => {
    expect(summarizeBitrixSyncJobs([job("already_running")]).kind).toBe("already_running");
    expect(summarizeBitrixSyncJobs([job("partial_success")]).kind).toBe("partial_success");
  });

  it.each([
    ["bitrix_unavailable", "Bitrix indisponível"],
    ["authentication_failure", "Permissão recusada"],
    ["timeout", "Tempo limite"],
    ["internal_failure", "Falha inesperada"],
  ] as const)("preserva %s como erro", (outcome, error) => {
    const result = summarizeBitrixSyncJobs([job(outcome, false, error)]);
    expect(result.kind).toBe("error");
    expect(result.message).toContain(error);
  });
});
