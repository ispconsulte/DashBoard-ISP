import { motion, AnimatePresence } from "framer-motion";
import {
  Crown,
  Medal,
  ChevronDown,
  Clock,
  Target,
  Zap,
  Heart,
  Layers,
  PieChart,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Info,
  ClipboardCheck,
  Mail,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

import type { BonusConsultantCard, BonusScoreBreakdown } from "@/modules/sprint6/hooks/useBonusRealData";
import { formatHoursHuman } from "@/modules/tasks/utils";
import { BONUS_EVALUATION_CATEGORIES } from "@/modules/sprint6/bonusEvaluation";
import {
  money,
  scoreColor,
  scoreBg,
  levelLabel,
  levelColor,
} from "./BonusHelpers";

/* ── Unavailable Chip ──────────────────────────────────────────────── */
function NoData({ text = "Sem dado disponível" }: { text?: string }) {
  return <span className="text-[11px] text-muted-foreground/40 italic">{text}</span>;
}

/* ── Score Composition Section ─────────────────────────────────────── */
function iconForFactor(key: string) {
  if (key.includes("hard") || key.includes("on_time")) return Target;
  if (key.includes("soft") || key.includes("util")) return Zap;
  if (key.includes("people") || key.includes("health")) return Heart;
  return AlertCircle;
}

function colorForFactor(key: string) {
  if (key.includes("on_time")) return { color: "bg-emerald-500", text: "text-emerald-400" };
  if (key.includes("hard")) return { color: "bg-teal-500", text: "text-teal-400" };
  if (key.includes("util")) return { color: "bg-cyan-500", text: "text-cyan-400" };
  if (key.includes("soft")) return { color: "bg-blue-500", text: "text-blue-400" };
  if (key.includes("health")) return { color: "bg-purple-500", text: "text-purple-400" };
  if (key.includes("people")) return { color: "bg-indigo-500", text: "text-indigo-400" };
  return { color: "bg-sky-500", text: "text-sky-400" };
}

function ScoreComposition({
  breakdown,
  score,
  maxBonus,
  payout,
  hideMonetary = false,
}: {
  breakdown: BonusScoreBreakdown;
  score: number;
  maxBonus: number;
  payout: number | null;
  hideMonetary?: boolean;
}) {
  const gap = payout == null ? 0 : maxBonus - payout;
  const sorted = [...breakdown.factors].sort((a, b) => b.contribution - a.contribution);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  return (
    <div className="space-y-3">
      {/* Header with automatic support score pill */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-xs font-bold text-foreground tracking-wide">Métricas automáticas de apoio</p>
          <p className="text-[10px] text-muted-foreground/40 leading-snug">Score calculado automaticamente — pode incluir dados desatualizados</p>
        </div>
        <div className={`rounded-lg px-2.5 py-1 ${scoreBg(score)}`}>
          <span className={`text-sm font-bold ${scoreColor(score)}`}>{score}%</span>
        </div>
      </div>

      {/* Quick insight chips */}
      {best && worst && best.key !== worst.key && (
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/15 bg-emerald-500/[0.06] px-3 py-1 text-[11px] font-medium text-emerald-300">
            <TrendingUp className="h-3 w-3" /> {best.label}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/15 bg-red-500/[0.06] px-3 py-1 text-[11px] font-medium text-red-300">
            <TrendingDown className="h-3 w-3" /> {worst.label}
          </span>
        </div>
      )}

      {/* Visual stacked bar */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-card/30">
        {breakdown.factors.map((factor) => {
          const palette = colorForFactor(factor.key);
          return (
            <div
              key={factor.key}
              style={{ width: `${Math.max(factor.contribution * 100, 0.5)}%` }}
              className={`h-full ${palette.color}/60 first:rounded-l-full last:rounded-r-full transition-all`}
              title={`${factor.label}: ${Math.round(factor.contribution * 100)}%`}
            />
          );
        })}
      </div>

      {/* Factor cards — compact visual grid */}
      <div className="grid gap-2 grid-cols-2">
        {breakdown.factors.map((factor) => {
          const CfgIcon = iconForFactor(factor.key);
          const palette = colorForFactor(factor.key);
          const normalizedPct = Math.round(factor.normalized * 100);
          const contributionPct = Math.round(factor.contribution * 100);
          const isGood = factor.normalized >= 0.7;
          const isMid = factor.normalized >= 0.4;

          return (
            <div key={factor.key} className="rounded-xl border border-border/8 bg-card/20 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${palette.color}/10`}>
                  <CfgIcon className={`h-3 w-3 ${palette.text}`} />
                </div>
                <p className="text-[11px] font-semibold text-foreground truncate flex-1">{factor.label}</p>
                <span className={`text-xs font-bold ${isGood ? "text-emerald-400" : isMid ? "text-amber-400" : "text-red-400"}`}>
                  {contributionPct}%
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-card/30 overflow-hidden">
                <div
                  style={{ width: `${normalizedPct}%` }}
                  className={`h-full rounded-full ${palette.color}/50 transition-all`}
                />
              </div>
              <p className="text-[10px] text-muted-foreground/50">
                peso {Math.round(factor.weight * 100)}%
              </p>
            </div>
          );
        })}
      </div>

      {/* Payout formula */}
      {!hideMonetary && (
        <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2">
          <p className="text-[11px] text-muted-foreground">
            <span className="text-foreground font-semibold">Nota do coordenador</span>
            {" × Teto "}
            <span className="text-foreground font-semibold">{money(maxBonus)}</span>
            {" = "}
            <span className="text-primary font-bold">{payout == null ? "Pendente" : money(payout)}</span>
          </p>
          {payout != null && gap > 0 && (
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">
              Faltam <span className="text-foreground/60 font-medium">{money(gap)}</span> para atingir o teto ({Math.round((gap / maxBonus) * 100)}%)
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const SKILL_LEGENDS_RANKING: Record<string, { description: string; color: string }> = {
  "Hard Skill Manual": { description: "Conhecimento técnico e qualidade de execução", color: "text-teal-400" },
  "Soft Skills": { description: "Comportamento, comunicação e organização", color: "text-blue-400" },
  "People Skills": { description: "Colaboração, empatia e interação com a equipe", color: "text-indigo-400" },
};

function formatPeriodKey(periodKey: string | null | undefined): string {
  if (!periodKey) return "";
  const [year, month] = periodKey.split("-");
  if (!year || !month) return periodKey;
  const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const monthLabel = months[parseInt(month, 10) - 1] ?? month;
  return `${monthLabel}/${year}`;
}

function formatDatePTBR(isoString: string | null | undefined): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} às ${hours}:${minutes}`;
  } catch {
    return "";
  }
}

function parseImprovementTags(raw: string): string[] {
  const bracketMatches = raw.match(/\[([^\]]+)\]/g);
  if (bracketMatches && bracketMatches.length > 0) {
    return bracketMatches.map((tag) => tag.slice(1, -1).trim()).filter(Boolean);
  }
  return raw.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
}

function ManualEvaluationSection({
  consultant,
  hideMonetary = false,
}: {
  consultant: BonusConsultantCard;
  hideMonetary?: boolean;
}) {
  const hasEvaluation = consultant.manualEvaluation.status === "submitted" || consultant.manualEvaluation.status === "draft";

  if (!hasEvaluation) return null;

  const evaluatorName = consultant.coordinatorName;
  const submittedAt = consultant.manualEvaluation.rows.find((row) => row.submitted_at)?.submitted_at ?? null;
  const formattedDate = formatDatePTBR(submittedAt);

  const summaryRows = [
    { key: "Hard Skill Manual", label: "Hard Skill Manual", value: consultant.manualEvaluation.hardManualScore, payout: consultant.manualEvaluation.hardManualPayout },
    { key: "Soft Skills", label: "Soft Skills", value: consultant.manualEvaluation.softSkillScore, payout: consultant.manualEvaluation.softSkillPayout },
    { key: "People Skills", label: "People Skills", value: consultant.manualEvaluation.peopleSkillScore, payout: consultant.manualEvaluation.peopleSkillPayout },
  ].filter((item) => item.value != null);

  const highlights = consultant.manualEvaluation.rows
    .filter((row) => row.justificativa || row.pontos_de_melhoria)
    .slice(0, 4);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold tracking-wide text-foreground">Avaliação do Coordenador</p>
        <Badge
          variant="outline"
          className={`text-[10px] ${
            consultant.manualEvaluation.status === "submitted"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
              : "border-amber-500/20 bg-amber-500/10 text-amber-300"
          }`}
        >
          {consultant.manualEvaluation.status === "submitted" ? "Fechada" : "Em rascunho"}
        </Badge>
      </div>

      {(evaluatorName || formattedDate) && (
        <p className="text-[11px] text-muted-foreground/60 -mt-1">
          {evaluatorName
            ? `Realizada por ${evaluatorName}${formattedDate ? ` em ${formattedDate}` : ""}`
            : formattedDate
            ? `Registrada em ${formattedDate}`
            : ""}
        </p>
      )}

      {summaryRows.length > 0 && (
        <div className={`grid gap-2 ${summaryRows.length === 1 ? "grid-cols-1" : summaryRows.length === 2 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-3"}`}>
          {summaryRows.map((item) => {
            const legend = SKILL_LEGENDS_RANKING[item.key];
            return (
              <div key={item.label} className="rounded-xl border border-border/8 bg-card/20 p-3.5 space-y-1">
                <p className={`text-[10px] uppercase tracking-wider font-semibold ${legend?.color ?? "text-muted-foreground/60"}`}>{item.label}</p>
                {legend && <p className="text-[10px] text-muted-foreground/45 leading-snug">{legend.description}</p>}
                <p className="mt-1 text-xl font-bold text-foreground">{Math.round(item.value!)}/100</p>
                {!hideMonetary && item.payout != null && (
                  <p className="text-[11px] text-muted-foreground/55">estimativa: {money(item.payout)}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {highlights.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 font-semibold px-0.5">Detalhes da avaliação</p>
          {highlights.map((row) => {
            const catLabel = row.category && BONUS_EVALUATION_CATEGORIES[row.category as keyof typeof BONUS_EVALUATION_CATEGORIES]
              ? BONUS_EVALUATION_CATEGORIES[row.category as keyof typeof BONUS_EVALUATION_CATEGORIES].label
              : (row.category ?? "");
            const subtopicLabel = row.category && row.subtopic
              ? BONUS_EVALUATION_CATEGORIES[row.category as keyof typeof BONUS_EVALUATION_CATEGORIES]?.subtopics.find((item) => item.key === row.subtopic)?.label ?? row.subtopic
              : (row.subtopic ?? "");
            const improvementTags = row.pontos_de_melhoria ? parseImprovementTags(row.pontos_de_melhoria) : [];

            return (
              <div key={`${row.category}-${row.subtopic}`} className="rounded-xl border border-border/8 bg-white/[0.02] p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">{catLabel}</p>
                    <p className="text-xs font-semibold text-foreground mt-0.5">{subtopicLabel}</p>
                  </div>
                  {row.score_1_10 != null && (
                    <span className={`text-sm font-bold shrink-0 ${Number(row.score_1_10) >= 8 ? "text-emerald-400" : Number(row.score_1_10) >= 5 ? "text-amber-400" : "text-red-400"}`}>
                      {Number(row.score_1_10)}/10
                    </span>
                  )}
                </div>
                {row.justificativa && (
                  <p className="text-xs leading-relaxed text-foreground/80">{row.justificativa}</p>
                )}
                {improvementTags.length > 0 && (
                  <div className="pt-1 space-y-1.5">
                    <p className="text-[10px] text-amber-400/80 font-semibold uppercase tracking-wider">Ponto de melhoria</p>
                    <div className="flex flex-wrap gap-1.5">
                      {improvementTags.map((tag) => (
                        <span key={tag} className="inline-flex items-center rounded-md border border-amber-500/20 bg-amber-500/[0.07] px-2 py-0.5 text-[11px] text-amber-300/90">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Main Ranking Card ─────────────────────────────────────────────── */
export function RankingCard({
  consultant,
  rank,
  expanded,
  onToggle,
  hideMonetary = false,
  canEvaluate = false,
  canSendReport = false,
  periodLabel,
  onEvaluate,
  onSendReport,
  showRank = true,
}: {
  consultant: BonusConsultantCard;
  rank: number;
  expanded: boolean;
  onToggle: () => void;
  hideMonetary?: boolean;
  canEvaluate?: boolean;
  canSendReport?: boolean;
  periodLabel?: string;
  onEvaluate?: (consultant: BonusConsultantCard) => void;
  onSendReport?: (consultant: BonusConsultantCard) => void;
  showRank?: boolean;
}) {
  const isTopThree = showRank && rank <= 3;
  const hasCoordinatorScore = consultant.coordinatorScore != null;
  const hasDisplayScore = consultant.scoreSource !== "none";
  const delta = hasCoordinatorScore
    ? Math.round((consultant.coordinatorScore as number) - consultant.automaticScore)
    : null;
  const deltaLabel = delta == null ? "—" : `${delta >= 0 ? "+" : ""}${delta} pts`;
  const deltaColor = delta == null
    ? "text-muted-foreground/50"
    : delta >= 0
    ? "text-emerald-400"
    : "text-red-400";
  const badgeColors = showRank
    ? rank === 1
      ? "text-amber-300 bg-amber-500/15 border-amber-500/20"
      : rank === 2
      ? "text-slate-300 bg-slate-500/12 border-slate-400/15"
      : rank === 3
      ? "text-orange-300 bg-orange-500/12 border-orange-400/15"
      : "text-muted-foreground bg-card/30 border-border/10"
    : "text-primary bg-primary/10 border-primary/15";

  return (
    <div className={`rounded-2xl border transition-all ${expanded ? "border-primary/20 bg-card/55" : "border-border/12 bg-card/35 hover:bg-card/45"}`}>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-2 sm:gap-3 p-3 sm:p-4 text-left">
        <div className={`flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-lg sm:rounded-xl border text-xs sm:text-sm font-bold ${badgeColors}`}>
          {showRank ? (isTopThree ? (rank === 1 ? <Crown className="h-4 w-4" /> : <Medal className="h-4 w-4" />) : rank) : <UserRound className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <p className="min-w-0 truncate text-xs font-bold text-foreground sm:text-sm">{consultant.name}</p>
            {["senior", "pleno", "junior"].includes(consultant.level) && (
              <Badge variant="outline" className={`text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 ${levelColor(consultant.level)}`}>
                {levelLabel(consultant.level)}
              </Badge>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground/50 hidden sm:flex">
            {consultant.projectCount > 0 && <span>{consultant.projectCount} projeto{consultant.projectCount > 1 ? "s" : ""}</span>}
            {consultant.hoursTracked > 0 && <><span className="text-muted-foreground/20">·</span><span>{formatHoursHuman(consultant.hoursTracked)}</span></>}
            {consultant.completedTasks > 0 && <><span className="text-muted-foreground/20">·</span><span>{consultant.completedTasks}/{consultant.totalTasks} tarefas</span></>}
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 md:gap-3 shrink-0">
          <div className={`rounded-lg sm:rounded-xl border px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-center ${hasDisplayScore ? scoreBg(consultant.score) : "border-border/10 bg-card/25"}`}>
            <p className={`text-sm sm:text-base font-bold ${hasDisplayScore ? scoreColor(consultant.score) : "text-muted-foreground/45"}`}>
              {hasDisplayScore ? `${consultant.score}%` : "—"}
            </p>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground/50">{hasCoordinatorScore ? "nota coord." : hasDisplayScore ? "score salvo" : "sem score"}</p>
          </div>
          {!hideMonetary && hasDisplayScore && consultant.payout != null && (
            <div className="rounded-lg sm:rounded-xl border border-primary/15 bg-primary/[0.06] px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-center">
              <p className="text-sm sm:text-base font-bold text-primary">{money(consultant.payout)}</p>
              <p className="text-[10px] sm:text-[11px] text-primary/50">de {money(consultant.maxBonus)}</p>
            </div>
          )}
        </div>
        <div className="ml-1 max-w-[7rem] shrink-0 text-right sm:hidden">
          {!hideMonetary && consultant.payout != null && <p className="text-xs font-bold text-primary">{money(consultant.payout)}</p>}
          <p className={`text-[11px] font-semibold ${hasDisplayScore ? scoreColor(consultant.score) : "text-muted-foreground/45"}`}>
            {hasDisplayScore ? `${consultant.score}%` : "—"}
          </p>
        </div>
        <ChevronDown className={`h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-muted-foreground/50 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/10 px-3 sm:px-5 pb-4 sm:pb-5 pt-4 space-y-4">
              <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-border/10 bg-white/[0.015] p-3.5 sm:p-4 md:flex-row md:items-center">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        consultant.manualEvaluation.status === "submitted"
                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                          : consultant.manualEvaluation.status === "draft"
                          ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
                          : "border-border/20 bg-card/30 text-muted-foreground/75"
                      }`}
                    >
                      {consultant.manualEvaluation.status === "submitted"
                        ? `Avaliado${consultant.manualEvaluation.periodKey ? ` · ${formatPeriodKey(consultant.manualEvaluation.periodKey)}` : ""}`
                        : consultant.manualEvaluation.status === "draft"
                        ? `Rascunho${consultant.manualEvaluation.periodKey ? ` · ${formatPeriodKey(consultant.manualEvaluation.periodKey)}` : ""}`
                        : "Sem avaliação"}
                    </Badge>
                    {consultant.coordinatorName && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60">
                        <UserRound className="h-3.5 w-3.5" />
                        Coordenação: <span className="text-foreground/80">{consultant.coordinatorName}</span>
                      </span>
                    )}
                  </div>
                </div>
                {(canEvaluate || canSendReport) && (
                  <div className="flex w-full flex-wrap gap-2.5 shrink-0 sm:w-auto">
                    {canEvaluate && (
                      <button
                        type="button"
                        onClick={() => onEvaluate?.(consultant)}
                        className="group/btn relative inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/8 px-4 py-2 text-xs font-semibold text-primary shadow-[0_0_12px_hsl(var(--primary)/0.06)] outline-none transition-all duration-200 hover:-translate-y-px hover:border-primary/35 hover:bg-primary/12 hover:shadow-[0_0_20px_hsl(var(--primary)/0.1)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/35 focus-visible:border-primary/40 active:translate-y-0 active:shadow-[0_0_8px_hsl(var(--primary)/0.08)] sm:flex-none"
                      >
                        <ClipboardCheck className="h-3.5 w-3.5 transition-transform duration-200 group-hover/btn:scale-110" />
                        {consultant.manualEvaluation.status === "submitted"
                          ? "Revisar Avaliação"
                          : consultant.manualEvaluation.status === "draft"
                          ? "Continuar Avaliação"
                          : "Avaliar"}
                      </button>
                    )}
                    {canSendReport && (
                      <button
                        type="button"
                        onClick={() => onSendReport?.(consultant)}
                        className="group/btn relative inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border/16 bg-card/35 px-4 py-2 text-xs font-semibold text-foreground/75 shadow-[0_1px_3px_rgba(0,0,0,0.2)] outline-none transition-all duration-200 hover:-translate-y-px hover:border-primary/18 hover:bg-card/55 hover:text-foreground/90 hover:shadow-[0_2px_10px_rgba(0,0,0,0.25)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/28 active:translate-y-0 active:shadow-[0_1px_2px_rgba(0,0,0,0.15)] sm:flex-none"
                      >
                        <Mail className="h-3.5 w-3.5 transition-transform duration-200 group-hover/btn:scale-110" />
                        Enviar Relatório
                      </button>
                    )}
                  </div>
                )}
              </div>

              <ScoreComposition
                breakdown={consultant.scoreBreakdown}
                score={consultant.automaticScore}
                maxBonus={consultant.maxBonus}
                payout={consultant.payout}
                hideMonetary={hideMonetary}
              />

              <ManualEvaluationSection consultant={consultant} hideMonetary={hideMonetary} />

              {(() => {
                const allMetrics = [
                  { icon: Clock, label: "Horas", value: consultant.hoursTracked > 0 ? formatHoursHuman(consultant.hoursTracked) : null },
                  { icon: Target, label: "No Prazo", value: consultant.onTimeRate != null ? `${Math.round(consultant.onTimeRate)}%` : null },
                  { icon: Zap, label: "Utilização", value: consultant.utilization != null ? `${Math.round(consultant.utilization)}%` : null },
                  { icon: Heart, label: "Carteira", value: consultant.healthScore != null ? `${consultant.healthScore} pts` : null },
                  { icon: Layers, label: "Tarefas", value: consultant.totalTasks > 0 ? `${consultant.completedTasks}/${consultant.totalTasks}` : null },
                  { icon: PieChart, label: "Projetos", value: consultant.projectCount > 0 ? String(consultant.projectCount) : null },
                  { icon: AlertCircle, label: "Atraso", value: consultant.overdueRate != null ? `${Math.round(consultant.overdueRate)}%` : null },
                ];
                const visibleMetrics = allMetrics.filter((metric) => metric.value != null);
                if (visibleMetrics.length === 0) return null;
                const metricsGridClass =
                  visibleMetrics.length <= 2
                    ? "grid-cols-1 sm:grid-cols-2"
                    : visibleMetrics.length <= 4
                    ? "grid-cols-1 min-[430px]:grid-cols-2 lg:grid-cols-4"
                    : "grid-cols-1 min-[430px]:grid-cols-2 md:grid-cols-3 2xl:grid-cols-5";

                return (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 font-semibold mb-2 px-0.5">
                      Métricas do período{periodLabel ? ` (${periodLabel})` : ""}
                    </p>
                    <div className={`grid min-w-0 gap-2.5 ${metricsGridClass}`}>
                      {visibleMetrics.map((metric) => (
                        <MetricTile key={metric.label} icon={metric.icon} label={metric.label} value={metric.value} />
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-start gap-2 rounded-lg border border-border/6 bg-card/10 px-3 py-2">
                <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground/25 mt-0.5" />
                <p className="text-[11px] text-muted-foreground/40 leading-relaxed">
                  A nota principal da bonificação vem da avaliação do coordenador. As métricas automáticas acima são apenas apoio para análise.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MetricTile({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string | null }) {
  if (value == null) return null;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/10 bg-card/25 p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/[0.06]">
        <Icon className="h-4 w-4 text-primary/60" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-bold text-foreground mt-0.5">{value}</p>
      </div>
    </div>
  );
}
