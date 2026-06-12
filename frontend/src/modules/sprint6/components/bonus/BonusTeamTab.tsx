import { useMemo, useState } from "react";
import { ClipboardCheck, Search, ChevronDown, AlertCircle, ShieldAlert, Cpu, UserCheck, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { BonusConsultantCard } from "@/modules/sprint6/hooks/useBonusRealData";
import type { AuthSession } from "@/modules/auth/hooks/useAuth";
import { normalizeName, money, scoreColor, scoreBg, levelLabel, levelColor } from "./BonusHelpers";
import { BONUS_EVALUATION_CATEGORIES, type BonusEvaluationCategory } from "@/modules/sprint6/bonusEvaluation";
import { AnimatePresence, motion } from "framer-motion";

/* ── Card de comparação de nota (sistema vs coordenador) ─────────────── */
function ScoreCompareCard({
  label,
  score,
  active,
  tone,
  caption,
  payout,
  hideMonetary,
}: {
  label: string;
  score: number | null;
  active: boolean;
  tone: "primary" | "emerald";
  caption: string;
  payout: number | null;
  hideMonetary: boolean;
}) {
  const has = score != null;
  const ring = active
    ? tone === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/[0.06]"
      : "border-primary/30 bg-primary/[0.06]"
    : "border-border/10 bg-card/20";
  const bar = tone === "emerald" ? "bg-emerald-500/55" : "bg-primary/55";
  const valueColor = tone === "emerald" ? "text-emerald-400" : "text-primary";
  return (
    <div className={`rounded-xl border p-3.5 transition-colors ${ring}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">{label}</p>
      </div>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <p className={`text-2xl font-extrabold leading-none ${has ? "text-foreground" : "text-muted-foreground/40"}`}>
          {has ? `${score}%` : "Pendente"}
        </p>
        {!hideMonetary && has && payout != null && (
          <p className={`text-sm font-bold leading-none ${valueColor}`}>{money(payout)}</p>
        )}
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-card/50">
        {has && <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(Math.max(score, 0), 100)}%` }} />}
      </div>
      <p className="mt-1.5 truncate text-[10px] text-muted-foreground/50">{caption}</p>
    </div>
  );
}

/* ── Dropdown de detalhamento (fechado por padrão) ───────────────────── */
function DetailDisclosure({
  title,
  icon: Icon,
  accent,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: typeof Cpu;
  accent: "primary" | "emerald";
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const iconColor = accent === "emerald" ? "text-emerald-400" : "text-primary";
  return (
    <div className="rounded-xl border border-border/8 bg-card/15 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left transition-colors hover:bg-card/30"
      >
        <Icon className={`h-3.5 w-3.5 shrink-0 ${iconColor}`} />
        <span className="flex-1 text-xs font-semibold text-foreground/85">{title}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/40 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/8 px-3.5 py-3 space-y-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface BonusTeamTabProps {
  subordinates: BonusConsultantCard[];
  session: AuthSession | null;
  periodLabel: string;
  hideMonetary?: boolean;
  onEvaluate: (consultant: BonusConsultantCard) => void;
  onSendReport: (consultant: BonusConsultantCard) => void;
}

export function BonusTeamTab({ subordinates, session, periodLabel, hideMonetary = false, onEvaluate, onSendReport }: BonusTeamTabProps) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Detalhamentos abertos (independentes): chave `${userId}:system` / `:coordinator`.
  const [openDetails, setOpenDetails] = useState<Set<string>>(new Set());
  // Modal de aviso ao tentar avaliar sem ser coordenador.
  const [notAllowedFor, setNotAllowedFor] = useState<BonusConsultantCard | null>(null);
  // Modal de aviso quando a pessoa ja tem avaliacao enviada no periodo.
  const [alreadyEvaluatedFor, setAlreadyEvaluatedFor] = useState<BonusConsultantCard | null>(null);

  const toggleDetail = (key: string) => {
    setOpenDetails((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

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

          // Payout de cada origem: sistema (automatico) e coordenador, sobre o mesmo teto.
          const systemPayout = Math.round((consultant.automaticScore / 100) * consultant.maxBonus);
          const coordinatorPayout = consultant.coordinatorScore != null
            ? Math.round((consultant.coordinatorScore / 100) * consultant.maxBonus)
            : null;

          const systemKey = `${consultant.userId}:system`;
          const coordKey = `${consultant.userId}:coordinator`;

          return (
            <div
              key={consultant.userId ?? consultant.name}
              className={`rounded-2xl border transition-all ${isExpanded ? "border-primary/20 bg-card/55" : "border-border/12 bg-card/35 hover:bg-card/45"}`}
            >
              {/* Header — sem horas/tarefas (ficam só nos indicadores operacionais expandidos) */}
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
                    <div className="space-y-4 border-t border-border/10 px-3 pb-5 pt-5 sm:px-5">
                      {/* ── Notas: Sistema vs Coordenador (com R$ do cálculo) ─────── */}
                      <div className="space-y-2.5">
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                          <ScoreCompareCard
                            label="Nota do sistema"
                            score={consultant.automaticScore}
                            active={consultant.scoreSource === "automatic"}
                            tone="primary"
                            caption="Prazo, atraso, utilização e saúde"
                            payout={systemPayout}
                            hideMonetary={hideMonetary}
                          />
                          <ScoreCompareCard
                            label="Nota do coordenador"
                            score={consultant.coordinatorScore}
                            active={consultant.scoreSource === "coordinator"}
                            tone="emerald"
                            caption={consultant.coordinatorName ? `Avaliação de ${consultant.coordinatorName}` : "Avaliação manual"}
                            payout={coordinatorPayout}
                            hideMonetary={hideMonetary}
                          />
                        </div>
                      </div>

                      {/* ── Detalhamentos em dropdown (fechados por padrão) ───────── */}
                      <div className="space-y-2">
                        {/* Sistema */}
                        <DetailDisclosure
                          title="Detalhamento nota do sistema"
                          icon={Cpu}
                          accent="primary"
                          open={openDetails.has(systemKey)}
                          onToggle={() => toggleDetail(systemKey)}
                        >
                          {consultant.scoreBreakdown.factors.map((f) => {
                            const pct = Math.round(f.normalized * 100);
                            const barColor = pct >= 70 ? "bg-emerald-500/55" : pct >= 40 ? "bg-amber-500/55" : "bg-red-500/55";
                            return (
                              <div key={f.key} className="space-y-1">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-foreground/80">{f.label}</span>
                                  <span className="text-muted-foreground/55">
                                    {f.rawDisplay} · <span className="font-semibold text-foreground/70">{Math.round(f.contribution * 100)} de {Math.round(f.weight * 100)} pts</span>
                                  </span>
                                </div>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-card/50">
                                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                          <p className="pt-1 text-[10px] italic text-muted-foreground/40">{consultant.scoreBreakdown.formulaLabel}</p>
                        </DetailDisclosure>

                        {/* Coordenador */}
                        {consultant.manualEvaluation.hasManualEvaluation ? (
                          <DetailDisclosure
                            title="Detalhamento nota do coordenador"
                            icon={UserCheck}
                            accent="emerald"
                            open={openDetails.has(coordKey)}
                            onToggle={() => toggleDetail(coordKey)}
                          >
                            {/* Resumo por categoria */}
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { label: "Hard Skill", value: consultant.manualEvaluation.hardManualScore },
                                { label: "Soft Skills", value: consultant.manualEvaluation.softSkillScore },
                                { label: "People Skills", value: consultant.manualEvaluation.peopleSkillScore },
                              ].map((i) => (
                                <div key={i.label} className="rounded-lg border border-border/8 bg-card/20 p-2 text-center">
                                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50">{i.label}</p>
                                  <p className="mt-0.5 text-sm font-bold text-foreground">
                                    {i.value != null ? `${Math.round(i.value)}` : "—"}<span className="text-[9px] font-medium text-muted-foreground/40">/100</span>
                                  </p>
                                </div>
                              ))}
                            </div>
                            {/* Notas por subtópico, com justificativa */}
                            {(() => {
                              const rows = consultant.manualEvaluation.rows.filter((r) => r.score_1_10 != null);
                              if (rows.length === 0) return null;
                              return (
                                <div className="space-y-1.5 pt-1">
                                  {rows.map((r) => {
                                    const cat = r.category as BonusEvaluationCategory | null;
                                    const subLabel = cat && r.subtopic
                                      ? BONUS_EVALUATION_CATEGORIES[cat]?.subtopics.find((s) => s.key === r.subtopic)?.label ?? r.subtopic
                                      : (r.subtopic ?? "");
                                    const n = Number(r.score_1_10);
                                    const nColor = n >= 8 ? "text-emerald-400" : n >= 5 ? "text-amber-400" : "text-red-400";
                                    return (
                                      <div key={`${r.category}-${r.subtopic}`} className="flex items-start justify-between gap-3 rounded-lg border border-border/6 bg-card/15 px-2.5 py-1.5">
                                        <div className="min-w-0">
                                          <p className="truncate text-[11px] font-medium text-foreground/80">{subLabel}</p>
                                          {r.justificativa && <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground/55">{r.justificativa}</p>}
                                        </div>
                                        <span className={`shrink-0 text-xs font-bold tabular-nums ${nColor}`}>{n}/10</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </DetailDisclosure>
                        ) : (
                          <div className="rounded-xl border border-border/8 bg-card/15 px-3.5 py-2.5 text-[11px] text-muted-foreground/50">
                            O coordenador ainda não registrou avaliação para este período.
                          </div>
                        )}
                      </div>

                      {/* ── Indicadores operacionais ──────────────────────────────── */}
                      {(() => {
                        const metrics = [
                          { label: "No prazo", value: consultant.onTimeRate != null ? `${Math.round(consultant.onTimeRate)}%` : null },
                          { label: "Utilização", value: consultant.utilization != null ? `${Math.round(consultant.utilization)}%` : null },
                          { label: "Projetos", value: consultant.projectCount > 0 ? String(consultant.projectCount) : null },
                          { label: "Tarefas", value: consultant.totalTasks > 0 ? `${consultant.completedTasks}/${consultant.totalTasks}` : null },
                          { label: "Horas", value: consultant.hoursTracked > 0 ? `${Math.round(consultant.hoursTracked)}h` : null },
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
                        <button
                          type="button"
                          onClick={() => {
                            if (!canEvaluate) { setNotAllowedFor(consultant); return; }
                            if (evalStatus === "submitted") { setAlreadyEvaluatedFor(consultant); return; }
                            onEvaluate(consultant);
                          }}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 sm:w-auto"
                        >
                          <ClipboardCheck className="h-4 w-4" />
                          {canEvaluate
                            ? (evalStatus === "submitted" ? "Revisar Avaliação" : evalStatus === "draft" ? "Continuar Avaliação" : "Avaliar")
                            : "Avaliar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => onSendReport(consultant)}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.08] px-5 py-2.5 text-sm font-semibold text-primary/90 transition-all hover:border-primary/40 hover:bg-primary/[0.14] sm:w-auto"
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

      {/* ── Modal de aviso: não é coordenador desta pessoa ──────────────── */}
      <Dialog open={notAllowedFor != null} onOpenChange={(o) => { if (!o) setNotAllowedFor(null); }}>
        <DialogContent className="max-w-sm p-0 overflow-hidden border-border/10 bg-[linear-gradient(180deg,hsl(224_35%_10%/0.99),hsl(229_33%_8%/0.99))] shadow-2xl shadow-black/50 sm:rounded-2xl rounded-none">
          <div className="h-1 w-full bg-gradient-to-r from-amber-500/60 via-amber-500/40 to-amber-500/10" />
          <div className="flex flex-col items-center gap-5 px-7 py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/15 bg-amber-500/10">
              <ShieldAlert className="h-6 w-6 text-amber-400" />
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-base font-bold tracking-tight text-foreground">
                Avaliação não permitida
              </DialogTitle>
              <DialogDescription className="text-[13px] leading-relaxed text-muted-foreground/65">
                {notAllowedFor?.coordinatorName
                  ? "Você não é o coordenador direto desta pessoa. Acione o coordenador responsável para registrar a nota."
                  : "Esta pessoa não tem coordenador vinculado. Solicite ao administrador que cadastre o vínculo de coordenação antes de avaliar."}
              </DialogDescription>
            </div>
            {notAllowedFor?.coordinatorName ? (
              <div className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/[0.07] px-3.5 py-2 text-xs font-medium text-foreground/80">
                <span className="h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                Coordenador responsável: <span className="font-semibold text-foreground/90">{notAllowedFor.coordinatorName}</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-xl border border-border/15 bg-card/30 px-3.5 py-2 text-xs font-medium italic text-muted-foreground/45">
                Nenhum coordenador vinculado
              </div>
            )}
            <button
              type="button"
              onClick={() => setNotAllowedFor(null)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border/15 bg-card/30 px-5 py-2.5 text-sm font-semibold text-foreground/70 transition-colors hover:bg-card/50 hover:text-foreground"
            >
              <X className="h-4 w-4" />
              Fechar
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal de aviso: usuário já tem avaliação no período ─────────── */}
      <Dialog open={alreadyEvaluatedFor != null} onOpenChange={(o) => { if (!o) setAlreadyEvaluatedFor(null); }}>
        <DialogContent className="max-w-sm p-0 overflow-hidden border-border/10 bg-[linear-gradient(180deg,hsl(224_35%_10%/0.99),hsl(229_33%_8%/0.99))] shadow-2xl shadow-black/50 sm:rounded-2xl rounded-none">
          <div className="h-1 w-full bg-gradient-to-r from-emerald-500/60 via-emerald-500/40 to-emerald-500/10" />
          <div className="flex flex-col items-center gap-5 px-7 py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/15 bg-emerald-500/10">
              <ClipboardCheck className="h-6 w-6 text-emerald-400" />
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-base font-bold tracking-tight text-foreground">
                Avaliação já registrada
              </DialogTitle>
              <DialogDescription className="text-[13px] leading-relaxed text-muted-foreground/65">
                {alreadyEvaluatedFor?.name} já tem avaliação enviada neste período. Você pode revisar e ajustar as notas, se necessário.
              </DialogDescription>
            </div>
            <div className="flex w-full flex-col gap-2.5">
              <button
                type="button"
                onClick={() => {
                  const target = alreadyEvaluatedFor;
                  setAlreadyEvaluatedFor(null);
                  if (target) onEvaluate(target);
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
              >
                <ClipboardCheck className="h-4 w-4" />
                Revisar avaliação
              </button>
              <button
                type="button"
                onClick={() => setAlreadyEvaluatedFor(null)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border/15 bg-card/30 px-5 py-2.5 text-sm font-semibold text-foreground/70 transition-colors hover:bg-card/50 hover:text-foreground"
              >
                Fechar
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
