import type { BonusConsultantCard } from "@/modules/sprint6/hooks/useBonusRealData";
import { formatHoursHuman } from "@/modules/tasks/utils";
import type { RoiPeriod } from "@/modules/sprint6/types";

/* ── Formatters ────────────────────────────────────────────────────── */
export function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

export function percent(value: number | null) {
  if (value == null) return "Sem dado disponível";
  return `${Math.round(value)}%`;
}

export function unavailableLabel(kind: "notFound" | "period" | "sync" | "notImplemented" = "period") {
  if (kind === "notFound") return "Sem dado disponível";
  if (kind === "sync") return "Aguardando sincronização";
  if (kind === "notImplemented") return "Ainda não alimentado";
  return "Sem dado neste período";
}

export function isUnavailableValue(value: string) {
  return [
    "Não encontrado",
    "Não disponível no período",
    "Aguardando sincronização",
    "Não implementado ainda",
  ].includes(value);
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function normalizeName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/* ── Helpers ───────────────────────────────────────────────────────── */
export function consultantDrivers(consultant: BonusConsultantCard) {
  const drivers: string[] = [];
  if (consultant.onTimeRate != null) drivers.push(`${consultant.onTimeRate}% no prazo`);
  if (consultant.utilization != null) drivers.push(`${Math.round(consultant.utilization)}% utilização`);
  if (consultant.hoursTracked > 0) drivers.push(`${formatHoursHuman(consultant.hoursTracked)} apontados`);
  if (consultant.projectCount > 0) drivers.push(`${consultant.projectCount} projetos`);
  if (consultant.healthScore != null) drivers.push(`Carteira ${Math.round(consultant.healthScore)} pts`);
  return drivers.slice(0, 4);
}

export function consultantExplanation(consultant: BonusConsultantCard) {
  const parts: string[] = [];
  if (consultant.onTimeRate != null) {
    parts.push(
      consultant.onTimeRate >= 85
        ? "boa entrega no prazo"
        : consultant.onTimeRate >= 70
        ? "entrega consistente"
        : "entrega com espaço para ajuste",
    );
  }
  if (consultant.utilization != null) {
    parts.push(
      consultant.utilization >= 70 && consultant.utilization <= 95
        ? "utilização equilibrada"
        : consultant.utilization > 95
        ? "utilização acima do ideal"
        : "utilização abaixo do ideal",
    );
  }
  if (consultant.projectCount > 0) {
    parts.push(`${consultant.projectCount} projeto${consultant.projectCount > 1 ? "s" : ""} na carteira`);
  }
  return parts.length ? parts.join(" · ") : "Sem base suficiente para explicar o valor ainda.";
}

export function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-amber-400";
  return "text-red-400";
}

export function scoreBg(score: number) {
  if (score >= 80) return "bg-emerald-500/10 border-emerald-500/20";
  if (score >= 60) return "bg-amber-500/10 border-amber-500/20";
  return "bg-red-500/10 border-red-500/20";
}

export function levelLabel(level: string) {
  if (level === "senior") return "Sênior";
  if (level === "pleno") return "Pleno";
  if (level === "junior") return "Júnior";
  return unavailableLabel("notFound");
}

export function levelColor(level: string) {
  if (level === "senior") return "border-purple-500/20 bg-purple-500/10 text-purple-300";
  if (level === "pleno") return "border-blue-500/20 bg-blue-500/10 text-blue-300";
  if (level === "junior") return "border-teal-500/20 bg-teal-500/10 text-teal-300";
  return "border-white/10 bg-white/[0.04] text-white/60";
}

export function periodLabel(period: RoiPeriod) {
  if (period === "30d") return "mensal";
  if (period === "90d") return "trimestral";
  if (period === "180d") return "semestral";
  return "histórico";
}

export function formatSyncTimestamp(value: string | null) {
  if (!value) return "aguardando primeiro sync";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "aguardando primeiro sync";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function executiveSyncSummary(value: string | null) {
  if (!value) return "Histórico inicial em preparação";
  const formatted = formatSyncTimestamp(value);
  return formatted === "aguardando primeiro sync" ? "Histórico inicial em preparação" : formatted;
}

export function syncHealthLabel(status?: string | null) {
  if (!status || status === "idle") return "em preparação";
  if (status === "success" || status === "synced") return "operando normalmente";
  if (status === "running") return "atualizando agora";
  if (status === "partial") return "parcialmente disponível";
  if (status === "error") return "requer atenção";
  if (status === "manual") return "atualização manual";
  return "em acompanhamento";
}
