import { useMemo, useState } from "react";
import { ClipboardCheck, Users, Search, ChevronDown, AlertCircle, TrendingUp, TrendingDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { BonusConsultantCard } from "@/modules/sprint6/hooks/useBonusRealData";
import type { AuthSession } from "@/modules/auth/hooks/useAuth";
import { normalizeName, scoreColor, scoreBg, levelLabel, levelColor } from "./BonusHelpers";
import { formatHoursHuman } from "@/modules/tasks/utils";
import { AnimatePresence, motion } from "framer-motion";

/* ── Card de comparação de nota (sistema vs coordenador) ─────────────── */
function ScoreCompareCard({
  label,
  score,
  active,
  tone,
  caption,
}: {
  label: string;
  score: number | null;
  active: boolean;
  tone: "primary" | "emerald";
  caption: string;
}) {
  const has = score != null;
  const ring = active
    ? tone === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/[0.06]"
      : "border-primary/30 bg-primary/[0.06]"
    : "border-border/10 bg-card/20";
  const badge = tone === "emerald" ? "bg-emerald-500/15 text-emerald-400" : "bg-primary/15 text-primary";
  const bar = tone === "emerald" ? "bg-emerald-500/55" : "bg-primary/55";
  return (
    <div className={`rounded-xl border p-3.5 transition-colors ${ring}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">{label}</p>
        {active && (
          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${badge}`}>Vale p/ $$</span>
        )}
      </div>
      <p className={`mt-1.5 text-2xl font-extrabold leading-none ${has ? "text-foreground" : "text-muted-foreground/40"}`}>
        {has ? `${score}%` : "Pendente"}
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-card/50">
        {has && <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(Math.max(score, 0), 100)}%` }} />}
      </div>
      <p className="mt-1.5 truncate text-[10px] text-muted-foreground/50">{caption}</p>
    </div>
  );
}

interface BonusTeamTabProps {
  subordinates: BonusConsultantCard[];
  session: AuthSession | null;
  periodLabel: string;
  onEvaluate: (consultant: BonusConsultantCard) => void;
  onSendReport: (consultant: BonusConsultantCard) => void;
}

export function BonusTeamTab({ subordinates, session, periodLabel, onEvaluate, onSendReport }: BonusTeamTabProps) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = normalizeName(search);
    if (!term) return subordinates;
    return subordinates.filter((c) => normalizeName(c.name).includes(term));
  }, [subordinates, search]);

  if (subordinates.length === 0) {
    return (
      <div className="rounded-2xl border border-border/15 bg-card/35 p-8 text-center space-y-3">
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/15">
            <AlertCircle className="h-6 w-6 text-amber-400" />
          </div>
        </div>
        <p className="text-sm font-semibold text-foreground/70">Nenhum subordinado encontrado</p>
        <p className="text-xs text-muted-foreground/50 max-w-md mx-auto leading-relaxed">
          Para que seus subordinados apareçam aqui, é necessário que os vínculos de coordenação estejam cadastrados no sistema.
          Entre em contato com o administrador para configurar os links de coordenação.
        </p>
        {session?.userId && (
          <p className="text-[10px] text-muted-foreground/30 font-mono mt-2">
            Seu ID de usuário: {session.userId}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      {/* Search */}
      {subordinates.length > 3 && (
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar na equipe..."
            className="h-10 min-w-0 rounded-xl border-border/15 bg-card/40 pl-10 text-sm"
          />
        </div>
      )}

      {/* Summary cards */}
      <div className="grid min-w-0 grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-xl border border-primary/12 bg-primary/[0.04] p-3.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">Membros da equipe</p>
          <p className="mt-1.5 text-lg font-bold leading-none text-primary">{subordinates.length}</p>
          <p className="mt-1 text-[11px] text-muted-foreground/50">subordinados diretos</p>
        </div>
        <div className="rounded-xl border border-emerald-500/12 bg-emerald-500/[0.04] p-3.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">Avaliados</p>
          <p className="mt-1.5 text-lg font-bold leading-none text-emerald-400">
            {subordinates.filter((c) => c.manualEvaluation.status === "submitted").length}/{subordinates.length}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground/50">{periodLabel}</p>
        </div>
        <div className="rounded-xl border border-amber-500/12 bg-amber-500/[0.04] p-3.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">Nota média do coordenador</p>
          <p className="mt-1.5 text-lg font-bold leading-none text-amber-400">
            {subordinates.some((c) => c.coordinatorScore != null)
              ? `${Math.round(subordinates.reduce((s, c) => s + (c.coordinatorScore ?? 0), 0) / subordinates.filter((c) => c.coordinatorScore != null).length)}%`
              : "Pendente"}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground/50">da equipe</p>
        </div>
      </div>

      {/* Subordinate cards */}
      <div className="space-y-3">
        {filtered.map((consultant) => {
          const isExpanded = expandedId === consultant.userId;
          const evalStatus = consultant.manualEvaluation.status;
          const hasCoordinatorScore = consultant.coordinatorScore != null;
          const hasDisplayScore = consultant.scoreSource !== "none";
          // Avaliar so e permitido ao coordenador direto. Acesso full (admin/payment
          // manager) ve a aba, mas nao avalia quem nao coordena.
          const canEvaluate = consultant.userId != null && (session?.coordinatorOf ?? []).includes(consultant.userId);

          return (
            <div
              key={consultant.userId ?? consultant.name}
              className={`rounded-2xl border transition-all ${isExpanded ? "border-primary/20 bg-card/55" : "border-border/12 bg-card/35 hover:bg-card/45"}`}
            >
              {/* Header */}
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : consultant.userId)}
                className="flex w-full items-center gap-2 p-3 text-left sm:gap-3 sm:p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/15 text-sm font-bold text-primary">
                  {consultant.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="min-w-0 truncate text-xs font-bold text-foreground sm:text-sm">{consultant.name}</p>
                    {["senior", "pleno", "junior"].includes(consultant.level) && (
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 ${levelColor(consultant.level)}`}>
                        {levelLabel(consultant.level)}
                      </Badge>
                    )}
                    {evalStatus === "submitted" && (
                      <Badge variant="outline" className="text-[10px] border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                        Avaliação enviada
                      </Badge>
                    )}
                    {evalStatus === "draft" && (
                      <Badge variant="outline" className="text-[10px] border-amber-500/20 bg-amber-500/10 text-amber-300">
                        Rascunho salvo
                      </Badge>
                    )}
                  </div>
                  <div className="mt-0.5 hidden items-center gap-2 text-[11px] text-muted-foreground/50 sm:flex">
                    {consultant.completedTasks > 0 && <span>{consultant.completedTasks} de {consultant.totalTasks} tarefas concluídas</span>}
                    {consultant.hoursTracked > 0 && <><span className="text-muted-foreground/20">·</span><span>{formatHoursHuman(consultant.hoursTracked)} registradas</span></>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                  <div className={`max-w-[6.5rem] rounded-xl border px-2 py-1.5 text-center sm:max-w-none sm:px-3 ${hasDisplayScore ? scoreBg(consultant.score) : "border-border/15 bg-card/25"}`}>
                    <p className={`text-sm font-bold ${hasDisplayScore ? scoreColor(consultant.score) : "text-muted-foreground/40"}`}>
                      {hasDisplayScore ? `${consultant.score}%` : "—"}
                    </p>
                    <p className="mt-0.5 hidden text-[9px] leading-none text-muted-foreground/35 min-[430px]:block">{hasCoordinatorScore ? "nota coord." : hasDisplayScore ? "score salvo" : "sem score"}</p>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground/50 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </div>
              </button>

              {/* Expanded */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-5 border-t border-border/10 px-3 pb-5 pt-5 sm:px-5">
                      {/* ── Notas: Sistema vs Coordenador ─────────────────────────
                          A nota do coordenador, quando existe, é a oficial usada no $$. */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/45">Comparação de notas</p>
                          {consultant.coordinatorScore != null && (() => {
                            const diff = consultant.coordinatorScore - consultant.automaticScore;
                            if (diff === 0) return <span className="text-[10px] font-medium text-muted-foreground/45">coordenador = sistema</span>;
                            const up = diff > 0;
                            return (
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${up ? "text-emerald-400" : "text-red-400"}`}>
                                {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {up ? "+" : ""}{diff} pts vs sistema
                              </span>
                            );
                          })()}
                        </div>
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                          {/* Sistema */}
                          <ScoreCompareCard
                            label="Nota do sistema"
                            score={consultant.automaticScore}
                            active={consultant.scoreSource === "automatic"}
                            tone="primary"
                            caption="Prazo, atraso, utilização e saúde"
                          />
                          {/* Coordenador */}
                          <ScoreCompareCard
                            label="Nota do coordenador"
                            score={consultant.coordinatorScore}
                            active={consultant.scoreSource === "coordinator"}
                            tone="emerald"
                            caption={consultant.coordinatorName ? `Avaliação de ${consultant.coordinatorName}` : "Avaliação manual"}
                          />
                        </div>
                      </div>

                      {/* ── Detalhamento da avaliação (Hard / Soft / People) ──────── */}
                      {consultant.manualEvaluation.hasManualEvaluation && (() => {
                        const skills = [
                          { label: "Hard Skill", value: consultant.manualEvaluation.hardManualScore },
                          { label: "Soft Skills", value: consultant.manualEvaluation.softSkillScore },
                          { label: "People Skills", value: consultant.manualEvaluation.peopleSkillScore },
                        ].filter((i) => i.value != null);
                        if (skills.length === 0) return null;
                        return (
                          <div className="space-y-2.5">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/45">Detalhamento da avaliação</p>
                            <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
                              {skills.map((i) => {
                                const pct = Math.round(i.value!);
                                const barColor = pct >= 70 ? "bg-emerald-500/60" : pct >= 40 ? "bg-amber-500/60" : "bg-red-500/60";
                                return (
                                  <div key={i.label} className="rounded-xl border border-border/8 bg-card/20 p-3">
                                    <div className="flex items-baseline justify-between">
                                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50">{i.label}</p>
                                      <p className="text-sm font-bold text-foreground">{pct}<span className="text-[10px] font-medium text-muted-foreground/40">/100</span></p>
                                    </div>
                                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-card/50">
                                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      {/* ── Indicadores operacionais ──────────────────────────────── */}
                      {(() => {
                        const metrics = [
                          { label: "No prazo", value: consultant.onTimeRate != null ? `${Math.round(consultant.onTimeRate)}%` : null },
                          { label: "Utilização", value: consultant.utilization != null ? `${Math.round(consultant.utilization)}%` : null },
                          { label: "Projetos", value: consultant.projectCount > 0 ? String(consultant.projectCount) : null },
                          { label: "Tarefas", value: consultant.totalTasks > 0 ? `${consultant.completedTasks}/${consultant.totalTasks}` : null },
                          { label: "Horas", value: consultant.hoursTracked > 0 ? formatHoursHuman(consultant.hoursTracked) : null },
                        ].filter((m) => m.value != null);
                        if (metrics.length === 0) return null;
                        return (
                          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-border/8 bg-card/15 px-4 py-3">
                            {metrics.map((m) => (
                              <div key={m.label} className="flex items-baseline gap-1.5">
                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/45">{m.label}</span>
                                <span className="text-sm font-bold text-foreground">{m.value}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                      {/* Action buttons */}
                      <div className="flex flex-col gap-2.5 border-t border-border/8 pt-4 sm:flex-row sm:flex-wrap">
                        {canEvaluate ? (
                          <button
                            type="button"
                            onClick={() => onEvaluate(consultant)}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/8 px-5 py-2.5 text-sm font-semibold text-primary transition-all hover:border-primary/35 hover:bg-primary/12 sm:w-auto"
                          >
                            <ClipboardCheck className="h-4 w-4" />
                            {evalStatus === "submitted" ? "Revisar Avaliação" : evalStatus === "draft" ? "Continuar Avaliação" : "Avaliar"}
                          </button>
                        ) : (
                          <span className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border/12 bg-card/25 px-5 py-2.5 text-xs font-medium text-muted-foreground/50 sm:w-auto">
                            <ClipboardCheck className="h-3.5 w-3.5" />
                            Apenas o coordenador direto avalia
                            {consultant.coordinatorName ? ` · ${consultant.coordinatorName}` : ""}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => onSendReport(consultant)}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border/16 bg-card/35 px-5 py-2.5 text-sm font-semibold text-foreground/75 transition-all hover:border-primary/18 hover:bg-card/55 sm:w-auto"
                        >
                          Enviar Relatório
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {filtered.length === 0 && search && (
          <div className="rounded-xl border border-border/15 bg-card/35 p-6 text-center">
            <p className="text-sm text-muted-foreground/60">Nenhum membro encontrado para "{search}"</p>
          </div>
        )}
      </div>
    </div>
  );
}
