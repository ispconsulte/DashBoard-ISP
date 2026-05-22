import { useMemo, useState } from "react";
import { ClipboardCheck, Users, Search, ChevronDown, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { BonusConsultantCard } from "@/modules/sprint6/hooks/useBonusRealData";
import type { AuthSession } from "@/modules/auth/hooks/useAuth";
import { normalizeName, scoreColor, scoreBg, levelLabel, levelColor } from "./BonusHelpers";
import { formatHoursHuman } from "@/modules/tasks/utils";
import { AnimatePresence, motion } from "framer-motion";

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
                    <div className="space-y-4 border-t border-border/10 px-3 pb-4 pt-4 sm:px-4">
                      {/* Metrics */}
                      <div className="grid min-w-0 grid-cols-1 gap-2 min-[430px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                        {[
                          { label: "Nota do coordenador", value: hasCoordinatorScore ? `${consultant.score}%` : null, placeholder: "Pendente de nota" },
                          { label: "Score registrado", value: !hasCoordinatorScore && hasDisplayScore ? `${consultant.score}%` : null, placeholder: null },
                          { label: "Score automático", value: `${consultant.automaticScore}%`, placeholder: null },
                          { label: "No Prazo", value: consultant.onTimeRate != null ? `${Math.round(consultant.onTimeRate)}%` : null, placeholder: null },
                          { label: "Utilização", value: consultant.utilization != null ? `${Math.round(consultant.utilization)}%` : null, placeholder: null },
                          { label: "Projetos", value: consultant.projectCount > 0 ? String(consultant.projectCount) : null, placeholder: null },
                        ].filter((m) => m.value != null || m.placeholder != null).map((m) => (
                          <div key={m.label} className="min-w-0 rounded-xl border border-border/8 bg-card/20 p-3 text-center">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50">{m.label}</p>
                            <p className={`mt-1 break-words text-base font-bold leading-tight ${m.value != null ? "text-foreground" : "text-muted-foreground/35"}`}>
                              {m.value ?? m.placeholder}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Manual eval summary */}
                      {consultant.manualEvaluation.hasManualEvaluation && (
                        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {[
                            { label: "Hard Skill Manual", value: consultant.manualEvaluation.hardManualScore },
                            { label: "Soft Skills", value: consultant.manualEvaluation.softSkillScore },
                            { label: "People Skills", value: consultant.manualEvaluation.peopleSkillScore },
                          ].filter((i) => i.value != null).map((i) => (
                            <div key={i.label} className="rounded-xl border border-border/8 bg-card/20 p-3">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50">{i.label}</p>
                              <p className="mt-1 text-lg font-bold text-foreground">{Math.round(i.value!)}/100</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
                        <button
                          type="button"
                          onClick={() => onEvaluate(consultant)}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/8 px-5 py-2.5 text-sm font-semibold text-primary transition-all hover:border-primary/35 hover:bg-primary/12 sm:w-auto"
                        >
                          <ClipboardCheck className="h-4 w-4" />
                          {evalStatus === "submitted" ? "Revisar Avaliação" : evalStatus === "draft" ? "Continuar Avaliação" : "Avaliar"}
                        </button>
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
