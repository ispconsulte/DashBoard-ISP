import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Info, Target, TrendingDown, TrendingUp, User, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { BonusConsultantCard } from "@/modules/sprint6/hooks/useBonusRealData";
import { money } from "./BonusHelpers";
import { SectionCard } from "./BonusSharedCards";

function FactorBar({
  title,
  explanation,
  dataSource,
  label,
  weight,
  contribution,
  normalized,
  rawDisplay,
  maxContribution,
  isExpanded,
  onToggle,
}: {
  title: string;
  explanation: string;
  dataSource: string;
  label: string;
  weight: number;
  contribution: number;
  normalized: number;
  rawDisplay: string;
  maxContribution: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const fillPct = maxContribution > 0 ? Math.min((contribution / maxContribution) * 100, 100) : 0;
  const isGood = normalized >= 70;
  const barColor = isGood ? "bg-emerald-500/60" : normalized >= 40 ? "bg-amber-500/60" : "bg-red-500/60";

  return (
    <div className="rounded-xl border border-border/8 bg-card/20 transition-all overflow-hidden">
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-2 border-b border-border/8 px-3 pb-2 pt-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground/70">{explanation}</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle();
                  }}
                  className="shrink-0 rounded-md p-1 text-muted-foreground/40 transition-colors hover:bg-white/[0.05] hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex flex-wrap gap-3 text-[11px]">
                <span className="text-muted-foreground/60">Valor bruto: <strong className="text-foreground">{rawDisplay}</strong></span>
                <span className="text-muted-foreground/60">Normalizado: <strong className="text-foreground">{Math.round(normalized)}%</strong></span>
                <span className="text-muted-foreground/60">Contribuição: <strong className="text-foreground">{contribution > 0.5 ? Math.round(contribution) : "<1"} de {Math.round(weight)} pts</strong></span>
              </div>
              <p className="text-[10px] italic text-muted-foreground/40">{dataSource}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={onToggle}
        className="group w-full cursor-pointer p-3 text-left transition-all hover:bg-card/35"
      >
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-foreground">{label}</span>
            <Info className={`h-3 w-3 transition-colors ${isExpanded ? "text-primary/60" : "text-muted-foreground/30 group-hover:text-muted-foreground/60"}`} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground/50">peso {Math.round(weight)}%</span>
            <span className="text-xs font-bold text-foreground">{contribution > 0.5 ? `${Math.round(contribution)}pts` : "0pts"}</span>
          </div>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-card/40">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(fillPct, contribution > 0 ? 6 : 0)}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={`h-full rounded-full ${barColor}`}
          />
        </div>
      </button>
    </div>
  );
}

interface BonusScoreCompositionProps {
  consultants: BonusConsultantCard[];
}

export function BonusScoreComposition({ consultants }: BonusScoreCompositionProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [expandedFactor, setExpandedFactor] = useState<string | null>(null);

  const selected = consultants[selectedIdx] ?? null;
  const hasData = consultants.length > 0 && selected;

  const factors = useMemo(() => {
    if (!selected) return [];
    return selected.scoreBreakdown.factors.map((factor) => ({
      key: factor.key,
      label: factor.label,
      title: factor.label,
      explanation: factor.explanation,
      dataSource: factor.dataSource,
      rawDisplay: factor.rawDisplay,
      normalized: factor.normalized * 100,
      weight: Math.round(factor.weight * 100),
      contribution: factor.contribution * 100,
    }));
  }, [selected]);

  const bestFactor = useMemo(() => {
    if (!factors.length) return null;
    return factors.reduce((best, factor) => (factor.contribution > best.contribution ? factor : best), factors[0]);
  }, [factors]);

  const worstFactor = useMemo(() => {
    if (!factors.length) return null;
    return factors.reduce((worst, factor) => (factor.contribution < worst.contribution ? factor : worst), factors[0]);
  }, [factors]);

  const maxWeight = Math.max(...factors.map((factor) => factor.weight), 1);

  return (
    <SectionCard
      title="Score do Consultor"
      icon={Target}
      badge={
        hasData ? (
          <Popover open={selectorOpen} onOpenChange={setSelectorOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-lg border border-border/12 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-white/[0.08]"
              >
                <User className="h-3 w-3 text-muted-foreground/50" />
                <span className="max-w-[120px] truncate">{selected.name}</span>
                <ChevronDown className="h-3 w-3 text-muted-foreground/40" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="max-h-64 w-56 overflow-y-auto rounded-xl border-border/15 bg-card/95 p-1.5 backdrop-blur-xl">
              {consultants.map((consultant, index) => (
                <button
                  key={consultant.name}
                  type="button"
                  onClick={() => {
                    setSelectedIdx(index);
                    setSelectorOpen(false);
                    setExpandedFactor(null);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-all ${index === selectedIdx ? "bg-primary/15 font-semibold text-primary" : "text-muted-foreground hover:bg-card/80 hover:text-foreground"}`}
                >
                  <span className="truncate">{consultant.name}</span>
                  <span className="ml-2 shrink-0 text-[11px] font-medium">{consultant.score}%</span>
                </button>
              ))}
            </PopoverContent>
          </Popover>
        ) : undefined
      }
    >
      {hasData ? (
        <div className="space-y-4">
          <div className="flex items-center gap-4 rounded-xl border border-border/10 bg-white/[0.02] p-3.5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10">
              <span className="text-xl font-bold text-primary">{selected.score}%</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{selected.name}</p>
              <p className="mt-1 text-xs font-semibold text-foreground">
                Payout: <span className="text-primary">{money(selected.payout)}</span>
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground/60">{selected.scoreBreakdown.formulaLabel}</p>
            </div>
          </div>

          {bestFactor && worstFactor && bestFactor.key !== worstFactor.key && (
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-start gap-2 rounded-lg border border-emerald-500/10 bg-emerald-500/[0.04] p-2.5">
                <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/60">Mais ajudou</p>
                  <p className="mt-0.5 text-xs font-medium text-foreground">{bestFactor.label}</p>
                  <p className="text-[10px] text-muted-foreground/50">{Math.round(bestFactor.contribution)} pts</p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-red-500/10 bg-red-500/[0.04] p-2.5">
                <TrendingDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-red-400/60">Menor impacto</p>
                  <p className="mt-0.5 text-xs font-medium text-foreground">{worstFactor.label}</p>
                  <p className="text-[10px] text-muted-foreground/50">{Math.round(worstFactor.contribution)} pts</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
              Clique em cada fator para ver detalhes
            </p>
            {factors.map((factor) => (
              <FactorBar
                key={factor.key}
                title={factor.title}
                explanation={factor.explanation}
                dataSource={factor.dataSource}
                label={factor.label}
                weight={factor.weight}
                contribution={factor.contribution}
                normalized={factor.normalized}
                rawDisplay={factor.rawDisplay}
                maxContribution={maxWeight}
                isExpanded={expandedFactor === factor.key}
                onToggle={() => setExpandedFactor(expandedFactor === factor.key ? null : factor.key)}
              />
            ))}
          </div>

          <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
            <p className="text-[11px] text-muted-foreground/60">
              <span className="font-medium text-foreground">Payout</span> = score ({selected.score}%) × teto ({money(selected.maxBonus)}) = <span className="font-bold text-primary">{money(selected.payout)}</span>
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border/10 bg-card/25 p-3">
              <p className="mb-2 text-xs font-semibold text-foreground">Pesos do Score</p>
              <div className="space-y-2.5">
                {[
                  { label: "Entregas no prazo", weight: 38 },
                  { label: "Risco de atraso", weight: 22 },
                  { label: "Aproveitamento", weight: 20 },
                  { label: "Saúde da carteira", weight: 20 },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2.5">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-card/40">
                      <div className="h-full rounded-full bg-primary/50" style={{ width: `${item.weight}%` }} />
                    </div>
                    <p className="shrink-0 text-xs text-muted-foreground">
                      <strong className="text-foreground">{item.weight}%</strong> {item.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-xl border border-border/10 bg-card/25 p-3">
                <p className="mb-2 text-xs font-semibold text-foreground">Teto por Nível</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <p className="text-lg font-bold text-teal-400">{money(1000)}</p>
                    <p className="text-[10px] text-muted-foreground">Júnior</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-blue-400">{money(2000)}</p>
                    <p className="text-[10px] text-muted-foreground">Pleno</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-purple-400">{money(3500)}</p>
                    <p className="text-[10px] text-muted-foreground">Sênior</p>
                  </div>
                </div>
              </div>
              <p className="px-1 text-xs text-muted-foreground">Payout = <strong className="text-foreground">score × teto</strong></p>
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground/50">
            Selecione um consultor no ranking para ver a composição detalhada do score.
          </p>
        </div>
      )}
    </SectionCard>
  );
}
