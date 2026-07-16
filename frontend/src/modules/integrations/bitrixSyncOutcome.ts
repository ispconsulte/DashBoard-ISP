import type { TriggerSyncPayload } from "@/modules/diagnostics/api/adminDiagnosticsApi";

type SyncJob = TriggerSyncPayload["jobs"][number];

export type BitrixSyncNotice = {
  kind: "success" | "noop" | "already_running" | "partial_success" | "error";
  message: string;
};

export function summarizeBitrixSyncJobs(jobs: SyncJob[]): BitrixSyncNotice {
  const failed = jobs.filter((job) => !job.ok);
  if (failed.length > 0) {
    const firstError = failed[0]?.error || "Erro não informado.";
    return {
      kind: "error",
      message: `Falha em ${failed.map((job) => job.job_name).join(", ")}: ${firstError}`,
    };
  }
  if (jobs.some((job) => job.outcome === "partial_success")) {
    return { kind: "partial_success", message: "Atualização concluída parcialmente. Consulte o progresso para os detalhes." };
  }
  if (jobs.length > 0 && jobs.every((job) => job.outcome === "noop")) {
    return { kind: "noop", message: "Nenhuma atualização pendente no momento." };
  }
  if (jobs.some((job) => job.outcome === "already_running")) {
    return { kind: "already_running", message: "Já existe uma atualização em andamento." };
  }
  return { kind: "success", message: "Atualização concluída com sucesso." };
}

export function bitrixJobStatusLabel(job?: SyncJob | null) {
  if (!job) return "Aguardando";
  if (!job.ok) return "Falhou";
  if (job.outcome === "noop") return "Sem pendências";
  if (job.outcome === "already_running") return "Em andamento";
  if (job.outcome === "partial_success") return "Parcial";
  return "Concluído";
}
