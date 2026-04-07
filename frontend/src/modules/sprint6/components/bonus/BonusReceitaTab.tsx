import { motion } from "framer-motion";
import { DollarSign, Layers, Info, AlertCircle } from "lucide-react";
import type { BonusProjectSpotlight, BonusRevenueSummary } from "@/modules/sprint6/hooks/useBonusRealData";
import type { BonusScoreSnapshotRow } from "@/modules/sprint6/hooks/useBonusPersistenceData";
import { formatHoursHuman } from "@/modules/tasks/utils";
import { money, percent, unavailableLabel, periodLabel } from "./BonusHelpers";
import { staggerContainer, staggerItem } from "./BonusAnimations";
import { SectionCard, FinancialTile, MicroBadge } from "./BonusSharedCards";
import type { RoiPeriod } from "@/modules/sprint6/types";

interface BonusReceitaTabProps {
  revenue: BonusRevenueSummary;
  projects: BonusProjectSpotlight[];
  displayedCroMonthly: number;
  displayedCroQuarterly: number;
  displayedAnnualStrategic: number;
  commercialSnapshot: BonusScoreSnapshotRow | null;
  revenueSnapshot: BonusScoreSnapshotRow | null;
  period: RoiPeriod;
  waitingFirstSync: boolean;
  noDataForPeriod: boolean;
}

/** Builds a user-friendly explanation of why a financial tile is empty */
function missingFinancialReason(
  hasFinancialSource: boolean,
  hasTrackedHours: boolean,
  field: "receita" | "custo" | "margem",
): string {
  if (!hasFinancialSource && field === "receita")
    return "Nenhum projeto possui receita cadastrada ainda";
  if (!hasFinancialSource && field === "custo")
    return "Sem dados financeiros cadastrados para calcular custo";
  if (!hasFinancialSource && field === "margem")
    return "Margem indisponível — falta receita e custo real";
  if (hasFinancialSource && !hasTrackedHours && field === "custo")
    return "Horas apontadas não encontradas para os projetos com dados financeiros";
  if (hasFinancialSource && field === "margem")
    return "Margem indisponível — receita ou custo insuficiente";
  return "Sem fonte de dados disponível neste período";
}

function financialValue(
  value: number,
  hasSource: boolean,
  formatter: (v: number) => string,
): string {
  if (!hasSource) return "—";
  return formatter(value);
}

export function BonusReceitaTab({
  revenue,
  projects,
  displayedCroMonthly,
  displayedCroQuarterly,
  displayedAnnualStrategic,
  commercialSnapshot,
  revenueSnapshot,
  period,
  waitingFirstSync,
  noDataForPeriod,
}: BonusReceitaTabProps) {
  const { hasFinancialSource, hasTrackedHours } = revenue;

  const receitaValue = hasFinancialSource && revenue.revenueTracked > 0
    ? money(revenue.revenueTracked)
    : hasFinancialSource
    ? money(0)
    : "—";

  const custoValue = hasFinancialSource && (revenue.estimatedCost > 0 || hasTrackedHours)
    ? money(revenue.estimatedCost)
    : "—";

  const margemValue = revenue.estimatedMargin != null && hasFinancialSource
    ? percent(revenue.estimatedMargin)
    : "—";

  const receitaSub = hasFinancialSource
    ? `monitorada · ${revenue.financialProjectCount} projeto${revenue.financialProjectCount !== 1 ? "s" : ""}`
    : missingFinancialReason(hasFinancialSource, hasTrackedHours, "receita");

  const custoSub = hasFinancialSource
    ? hasTrackedHours
      ? "horas realizadas × custo/hora"
      : missingFinancialReason(hasFinancialSource, hasTrackedHours, "custo")
    : missingFinancialReason(hasFinancialSource, hasTrackedHours, "custo");

  const margemSub = revenue.estimatedMargin != null && hasFinancialSource
    ? "sobre a receita monitorada"
    : missingFinancialReason(hasFinancialSource, hasTrackedHours, "margem");

  const margemColor = !hasFinancialSource || revenue.estimatedMargin == null
    ? "orange" as const
    : (revenue.estimatedMargin ?? 0) >= 30
    ? "emerald" as const
    : "red" as const;

  return (
    <div className="space-y-5">
      {/* Source warning banner when no financial data exists */}
      {!hasFinancialSource && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div className="text-xs text-amber-300/90">
            <p className="font-semibold">Nenhum dado financeiro cadastrado</p>
            <p className="mt-0.5 text-amber-300/60">
              Cadastre receita e custo nos projetos para que os indicadores financeiros sejam calculados automaticamente.
            </p>
          </div>
        </motion.div>
      )}

      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid gap-4 xl:grid-cols-2">
        <motion.div variants={staggerItem}>
          <SectionCard title="Resumo Financeiro" icon={DollarSign}>
            <div className="grid gap-3 grid-cols-2">
              <FinancialTile label="Receita" value={receitaValue} sub={receitaSub} color="blue" />
              <FinancialTile label="Custo Estimado" value={custoValue} sub={custoSub} color="orange" />
              <FinancialTile label="Margem" value={margemValue} sub={margemSub} color={margemColor} />
              <FinancialTile
                label="Bônus CRO"
                value={hasFinancialSource ? money(displayedCroMonthly) : "—"}
                sub={
                  !hasFinancialSource
                    ? "Depende de dados financeiros dos projetos"
                    : commercialSnapshot
                    ? `snapshot ${periodLabel(period)}`
                    : "estimativa mensal"
                }
                color="purple"
              />
            </div>
            <div className="mt-4 grid gap-3 grid-cols-2">
              <div className="rounded-xl border border-border/10 bg-card/25 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Bônus Trimestral (NRR)</p>
                <p className="mt-2 text-xl font-bold text-foreground">
                  {hasFinancialSource ? money(displayedCroQuarterly) : "—"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  {!hasFinancialSource
                    ? "Requer dados financeiros para cálculo"
                    : revenueSnapshot
                    ? revenueSnapshot.source_provenance === "calculated"
                      ? `Proxy trimestral para ${periodLabel(period)}`
                      : `Snapshot trimestral para ${periodLabel(period)}`
                    : displayedCroQuarterly > 0
                    ? "Meta de carteira saudável atingida"
                    : unavailableLabel("period")}
                </p>
              </div>
              <div className="rounded-xl border border-border/10 bg-card/25 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Bônus Estratégico Anual</p>
                <p className="mt-2 text-xl font-bold text-foreground">
                  {hasFinancialSource ? money(displayedAnnualStrategic) : "—"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  {!hasFinancialSource
                    ? "Requer receita e margem reais cadastradas"
                    : displayedAnnualStrategic > 0
                    ? "Margem e receita calculadas; MRR depende de contratos."
                    : unavailableLabel("notImplemented")}
                </p>
              </div>
            </div>
          </SectionCard>
        </motion.div>

        <motion.div variants={staggerItem}>
          <SectionCard title="Projetos Relevantes" icon={Layers}>
            <div className="space-y-3">
              {projects.map((project, idx) => (
                <motion.div
                  key={project.projectId}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="group rounded-xl border border-border/10 bg-card/25 p-4 transition-colors hover:bg-card/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-foreground">{project.projectName}</p>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        <MicroBadge label={money(project.receita)} color="blue" />
                        <MicroBadge label={`ROI ${percent(project.roi)}`} color={(project.roi ?? 0) > 0 ? "emerald" : "red"} />
                        <MicroBadge label={`Margem ${percent(project.margin)}`} color={(project.margin ?? 0) >= 30 ? "emerald" : "amber"} />
                        <MicroBadge label={formatHoursHuman(project.hoursUsed)} color="gray" />
                      </div>
                    </div>
                    <div className="shrink-0 rounded-xl bg-primary/10 px-3.5 py-2.5 text-right">
                      <p className="text-lg font-bold text-primary">{money(project.receita)}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
              {projects.length === 0 && (
                <div className="rounded-xl border border-border/10 bg-card/25 p-8 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Info className="h-5 w-5 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      {waitingFirstSync
                        ? "Aguardando primeira sincronização de dados."
                        : !hasFinancialSource
                        ? "Nenhum projeto possui dados financeiros cadastrados. Adicione receita e custo nos projetos para visualizar aqui."
                        : noDataForPeriod
                        ? `Nenhum projeto com dados financeiros encontrado em ${periodLabel(period)}.`
                        : "Nenhum projeto com base financeira suficiente para exibição."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        </motion.div>
      </motion.div>
    </div>
  );
}
