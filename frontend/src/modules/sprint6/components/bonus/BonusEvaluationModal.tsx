import { useEffect, useMemo, useState, useCallback } from "react";
import { ClipboardCheck, Loader2, Calendar, Save, SendHorizonal, ChevronDown, Check, ShieldAlert, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

import { Textarea } from "@/components/ui/textarea";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabaseExt as supabase } from "@/lib/supabase";
import type { BonusConsultantCard } from "@/modules/sprint6/hooks/useBonusRealData";
import type { AuthSession } from "@/modules/auth/hooks/useAuth";
import { toast } from "sonner";
import { notifyError } from "@/lib/friendlyError";
import {
  averageNumbers,
  BONUS_EVALUATION_CATEGORIES,
  getBonusCategoryPayoutFromScore,
  type BonusEvaluationCategory,
  type BonusEvaluationStatus,
} from "@/modules/sprint6/bonusEvaluation";

/* ── Types ──────────────────────────────────────────────────────────── */
type SubtopicValue = {
  score: number;
  /** false = ainda nao avaliado (nota nao foi definida pelo usuario). O score 5
   *  serve apenas como base do slider; a UI mostra "Sem nota" enquanto for false. */
  scored: boolean;
  justificativa: string;
  justificativa_chips: string[];
  pontos_de_melhoria: string;
  pontos_de_melhoria_chips: string[];
};
type EvaluationFormState = Record<BonusEvaluationCategory, Record<string, SubtopicValue>>;

const categoryKeys = Object.keys(BONUS_EVALUATION_CATEGORIES) as BonusEvaluationCategory[];

const CAT_PT: Record<BonusEvaluationCategory, string> = {
  hard_skill_manual: "Técnicas",
  soft_skill: "Comportamentais",
  people_skill: "Interpessoais",
};

/* ── Observation suggestions per subtopic ───────────────────────────── */
const OBSERVATION_POOL = [
  "Organização",
  "Qualidade técnica",
  "Cumprimento de prazo",
  "Documentação",
  "Comunicação",
  "Colaboração",
  "Autonomia",
  "Atenção aos detalhes",
  "Proatividade",
  "Consistência",
] as const;

type Observation = (typeof OBSERVATION_POOL)[number];

/** Maps subtopic keys → most relevant suggestions shown first */
const SUBTOPIC_SUGGESTIONS: Record<string, Observation[]> = {
  qualidade_tecnica: ["Qualidade técnica", "Atenção aos detalhes", "Documentação", "Consistência"],
  conformidade_documental: ["Documentação", "Organização", "Atenção aos detalhes", "Cumprimento de prazo"],
  organizacao_evidencias: ["Organização", "Documentação", "Atenção aos detalhes", "Qualidade técnica"],
  organizacao: ["Organização", "Cumprimento de prazo", "Atenção aos detalhes", "Autonomia"],
  proatividade: ["Proatividade", "Autonomia", "Comunicação", "Colaboração"],
  comunicacao: ["Comunicação", "Colaboração", "Proatividade", "Organização"],
  responsabilidade: ["Cumprimento de prazo", "Consistência", "Organização", "Autonomia"],
  trabalho_equipe: ["Colaboração", "Comunicação", "Proatividade", "Organização"],
  relacionamento_cliente: ["Comunicação", "Proatividade", "Atenção aos detalhes", "Colaboração"],
  receptividade_feedback: ["Comunicação", "Proatividade", "Colaboração", "Consistência"],
};

function getSuggestions(subtopicKey: string): Observation[] {
  return SUBTOPIC_SUGGESTIONS[subtopicKey] ?? [...OBSERVATION_POOL].slice(0, 5);
}

function buildDefaultState(): EvaluationFormState {
  return categoryKeys.reduce((acc, cat) => {
    acc[cat] = BONUS_EVALUATION_CATEGORIES[cat].subtopics.reduce((inner, sub) => {
      inner[sub.key] = { score: 5, scored: false, justificativa: "", justificativa_chips: [], pontos_de_melhoria: "", pontos_de_melhoria_chips: [] };
      return inner;
    }, {} as EvaluationFormState[BonusEvaluationCategory]);
    return acc;
  }, {} as EvaluationFormState);
}

/** Extract bracket tags from stored string and return { chips, text } */
function parseBracketField(raw: string): { chips: string[]; text: string } {
  const chips: string[] = [];
  const cleaned = raw.replace(/\[([^\]]+)\]/g, (_, tag: string) => { chips.push(tag.trim()); return ""; }).replace(/\s{2,}/g, " ").trim();
  return { chips, text: cleaned };
}

/** Compose stored value from chips + free text */
function composeField(chips: string[], text: string): string {
  const chipsPart = chips.length > 0 ? chips.join(", ") : "";
  if (!chipsPart && !text.trim()) return "";
  if (!chipsPart) return text.trim();
  if (!text.trim()) return chipsPart;
  return `${chipsPart}. ${text.trim()}`;
}

/* ── Score visual helpers ───────────────────────────────────────────── */
function scoreColor(score: number) {
  if (score >= 8) return { dot: "bg-emerald-500", glow: "shadow-[0_0_8px_rgba(16,185,129,0.4)]", text: "text-emerald-400", bg: "bg-emerald-500/10", ring: "ring-emerald-500/25", border: "border-emerald-500/20" };
  if (score >= 5) return { dot: "bg-amber-500", glow: "shadow-[0_0_8px_rgba(245,158,11,0.35)]", text: "text-amber-400", bg: "bg-amber-500/10", ring: "ring-amber-500/25", border: "border-amber-500/20" };
  return { dot: "bg-red-500", glow: "shadow-[0_0_8px_rgba(239,68,68,0.35)]", text: "text-red-400", bg: "bg-red-500/10", ring: "ring-red-500/25", border: "border-red-500/20" };
}

function scoreDot(score: number) {
  const c = scoreColor(score);
  return `${c.dot} ${c.glow}`;
}

function scoreRing(score: number) {
  return scoreColor(score).ring;
}

function scoreLabel(score: number) {
  if (score >= 9) return "Excelente";
  if (score >= 7) return "Bom";
  if (score >= 5) return "Regular";
  if (score >= 3) return "Fraco";
  return "Crítico";
}

/* ── Score cell color for the grid ──────────────────────────────────── */
function cellColor(n: number) {
  if (n >= 8) return { active: "bg-emerald-500/20 border-emerald-500/30 text-emerald-300", hover: "hover:bg-emerald-500/8 hover:border-emerald-500/15" };
  if (n >= 5) return { active: "bg-amber-500/20 border-amber-500/30 text-amber-300", hover: "hover:bg-amber-500/8 hover:border-amber-500/15" };
  return { active: "bg-red-500/20 border-red-500/30 text-red-300", hover: "hover:bg-red-500/8 hover:border-red-500/15" };
}

/* ── Score selector grid component ──────────────────────────────────── */
function ScoreGrid({ value, onChange, active = true }: { value: number; onChange: (n: number) => void; active?: boolean }) {
  return (
    <div className="grid grid-cols-10 gap-1">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
        const isSelected = active && n === value;
        const colors = cellColor(n);
        return (
          <motion.button
            key={n}
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => onChange(n)}
            className={`relative flex items-center justify-center h-9 rounded-lg border text-xs font-bold tabular-nums transition-all duration-150 ${
              isSelected
                ? `${colors.active} shadow-sm`
                : `border-border/8 bg-white/[0.015] text-muted-foreground/40 ${colors.hover}`
            }`}
          >
            {n}
            {isSelected && (
              <motion.div
                layoutId="score-indicator"
                className="absolute inset-0 rounded-lg ring-1 ring-primary/12"
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

/* ── Observation chip ────────────────────────────────────────────────── */
function ObservationChip({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all active:scale-[0.97] ${
        selected
          ? "border-primary/25 bg-primary/15 text-primary"
          : "border-border/10 bg-white/[0.02] text-muted-foreground/60 hover:border-border/20 hover:bg-white/[0.04] hover:text-muted-foreground"
      }`}
    >
      {selected && <Check className="h-3 w-3" />}
      {label}
    </button>
  );
}

/* ── Toggle chip in array ───────────────────────────────────────────── */
function toggleChip(chips: string[], obs: string): string[] {
  return chips.includes(obs) ? chips.filter((c) => c !== obs) : [...chips, obs];
}

/* ── Collapsible subtopic card ──────────────────────────────────────── */
function SubtopicCard({
  subtopicKey,
  label,
  description,
  value,
  isOpen,
  onToggle,
  onChange,
}: {
  subtopicKey: string;
  label: string;
  description: string;
  value: SubtopicValue;
  isOpen: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<SubtopicValue>) => void;
}) {
  const justChips = value.justificativa_chips ?? [];
  const melhChips = value.pontos_de_melhoria_chips ?? [];
  const filled = value.justificativa.trim().length > 0 || justChips.length > 0;
  const hasPreset = value.score !== 5 || filled || value.pontos_de_melhoria.trim().length > 0 || melhChips.length > 0;
  const suggestions = getSuggestions(subtopicKey);

  return (
    <div className="space-y-1">
    <motion.div
      layout
      className={`rounded-2xl border overflow-hidden transition-all duration-200 ${
        isOpen
          ? "border-primary/12 bg-white/[0.025] shadow-[0_2px_16px_rgba(0,0,0,0.15)]"
          : "border-border/6 bg-white/[0.01] hover:border-border/12 hover:bg-white/[0.018]"
      }`}
    >
      {/* ── Collapsed header ──────────────────────────────────── */}
      <button
        type="button"
        onClick={onToggle}
        className="group flex w-full items-center gap-3 px-4 py-3.5 text-left transition-all active:bg-white/[0.03]"
      >
        <span className={`h-2 w-2 shrink-0 rounded-full transition-shadow ${value.scored ? scoreDot(value.score) : "bg-muted-foreground/25"}`} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-foreground/90 leading-snug tracking-tight">{label}</p>
          {!isOpen && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-0.5 text-[11px] text-muted-foreground/40 truncate"
            >
              {value.scored ? `${value.score}/10 · ${scoreLabel(value.score)}` : "Sem nota definida"}
              {filled ? " · ✓ Justificativa preenchida" : value.scored ? "" : " · toque para avaliar"}
            </motion.p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {filled && !isOpen && (
            <div className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-emerald-500/12">
              <Check className="h-2.5 w-2.5 text-emerald-400" />
            </div>
          )}
          <div className={`flex items-center justify-center h-7 min-w-[28px] rounded-lg ring-1 ${value.scored ? scoreRing(value.score) : "ring-border/15"} bg-white/[0.03] px-1.5`}>
            <span className={`text-xs font-bold tabular-nums ${value.scored ? "text-foreground" : "text-muted-foreground/40"}`}>{value.scored ? value.score : "—"}</span>
          </div>
          <ChevronDown
            className={`h-3.5 w-3.5 text-muted-foreground/30 transition-transform duration-250 ${isOpen ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* ── Expanded body ────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key={subtopicKey}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/6 px-4 py-4 sm:px-5 sm:py-5 space-y-5">
              {/* Description — minimal */}
              <p className="text-[11px] text-muted-foreground/40 leading-relaxed max-w-md">{description}</p>

              {/* ── Score area — grid + prominent readout ──────── */}
              <div className="rounded-xl bg-white/[0.015] border border-border/6 p-4 space-y-3">
                {/* Readout row */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/35">Nota</span>
                  <div className="flex items-center gap-2">
                    <motion.span
                      key={value.score}
                      initial={{ scale: 1.15, opacity: 0.6 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 ${scoreColor(value.score).bg} ${scoreColor(value.score).border} border`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${scoreColor(value.score).dot}`} />
                      <span className={`text-sm font-bold tabular-nums ${scoreColor(value.score).text}`}>{value.score}/10</span>
                    </motion.span>
                    <motion.span
                      key={`label-${value.score}`}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-[10px] font-medium text-muted-foreground/30"
                    >
                      {scoreLabel(value.score)}
                    </motion.span>
                  </div>
                </div>

                {/* Score grid */}
                <ScoreGrid value={value.score} onChange={(n) => onChange({ score: n })} active={value.scored} />
              </div>

              {/* ── Justificativa ────────────────────────────────── */}
              <div className="space-y-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/35">
                  Justificativa
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((obs) => (
                    <ObservationChip
                      key={obs}
                      label={obs}
                      selected={justChips.includes(obs)}
                      onToggle={() => onChange({ justificativa_chips: toggleChip(justChips, obs) })}
                    />
                  ))}
                </div>
                <Textarea
                  value={value.justificativa}
                  onChange={(e) => onChange({ justificativa: e.target.value })}
                  placeholder="Detalhe adicional, se necessário..."
                  rows={2}
                  className="resize-none rounded-xl border-border/6 bg-white/[0.02] text-sm placeholder:text-muted-foreground/25 focus-visible:ring-1 focus-visible:ring-primary/20"
                />
              </div>

              {/* ── Sugestões de melhoria ─────────────────────────── */}
              <div className="space-y-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/35">
                  Sugestões de melhoria
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((obs) => (
                    <ObservationChip
                      key={obs}
                      label={obs}
                      selected={melhChips.includes(obs)}
                      onToggle={() => onChange({ pontos_de_melhoria_chips: toggleChip(melhChips, obs) })}
                    />
                  ))}
                </div>
                <Textarea
                  value={value.pontos_de_melhoria}
                  onChange={(e) => onChange({ pontos_de_melhoria: e.target.value })}
                  placeholder="O que pode melhorar..."
                  rows={2}
                  className="resize-none rounded-xl border-border/6 bg-white/[0.02] text-sm placeholder:text-muted-foreground/25 focus-visible:ring-1 focus-visible:ring-primary/20"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
      {!isOpen && hasPreset && (
        <p className="px-4 pb-1 text-[10px] text-muted-foreground/30 italic leading-tight">
          Já existem dados pré-setados — revise e ajuste se necessário.
        </p>
      )}
    </div>
  );
}

/* ── Main modal ─────────────────────────────────────────────────────── */
export function BonusEvaluationModal({
  open,
  consultant,
  session,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  consultant: BonusConsultantCard | null;
  session: AuthSession | null;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<BonusEvaluationCategory>("hard_skill_manual");
  const [form, setForm] = useState<EvaluationFormState>(buildDefaultState);
  const [saving, setSaving] = useState(false);
  const [loadingPeriod, setLoadingPeriod] = useState(false);
  const [periodMonth, setPeriodMonth] = useState<number>(new Date().getMonth() + 1);
  const [periodYear, setPeriodYear] = useState<number>(new Date().getFullYear());
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [loadedRowCount, setLoadedRowCount] = useState(0);
  // Vira true quando o avaliador realmente mexe em algo. O formulario inicia com
  // notas 5 pre-setadas, entao sem isso o "Finalizar" salvaria uma avaliacao que o
  // usuario nunca preencheu de fato.
  const [touched, setTouched] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const periodKey = `${periodYear}-${String(periodMonth).padStart(2, "0")}`;

  const monthOptions = useMemo(
    () => [
      { value: 1, label: "Janeiro" }, { value: 2, label: "Fevereiro" }, { value: 3, label: "Março" },
      { value: 4, label: "Abril" }, { value: 5, label: "Maio" }, { value: 6, label: "Junho" },
      { value: 7, label: "Julho" }, { value: 8, label: "Agosto" }, { value: 9, label: "Setembro" },
      { value: 10, label: "Outubro" }, { value: 11, label: "Novembro" }, { value: 12, label: "Dezembro" },
    ],
    [],
  );
  const yearOptions = useMemo(() => {
    const base = new Date().getFullYear();
    return [base - 1, base, base + 1];
  }, []);

  // All sections start collapsed
  useEffect(() => {
    setExpandedKey(null);
  }, [activeTab]);

  useEffect(() => {
    if (!open) return;
    if (consultant?.manualEvaluation.periodKey) {
      const [y, m] = consultant.manualEvaluation.periodKey.split("-").map(Number);
      if (y && m) { setPeriodYear(y); setPeriodMonth(m); return; }
    }
    setPeriodMonth(new Date().getMonth() + 1);
    setPeriodYear(new Date().getFullYear());
  }, [consultant, open]);

  useEffect(() => {
    if (!open || !consultant?.userId) return;
    let cancelled = false;

    const loadPeriod = async () => {
      setLoadingPeriod(true);
      try {
        const next = buildDefaultState();
        const { data, error } = await supabase
          .from("bonus_internal_evaluations")
          .select("category, subtopic, score_1_10, justificativa, pontos_de_melhoria")
          .eq("evaluation_scope", "consultant")
          .eq("user_id", consultant.userId)
          .eq("evaluator_user_id", session?.userId ?? "")
          .eq("period_year", periodYear)
          .eq("period_month", periodMonth);

        if (error) throw error;
        if (!cancelled) setLoadedRowCount((data ?? []).length);

        (data ?? []).forEach((row: { category: string | null; subtopic: string | null; score_1_10: number | null; justificativa: string | null; pontos_de_melhoria: string | null }) => {
          if (!row.category || !row.subtopic || !next[row.category as BonusEvaluationCategory]?.[row.subtopic]) return;
          const justParsed = parseBracketField(row.justificativa ?? "");
          const melhoraParsed = parseBracketField(row.pontos_de_melhoria ?? "");
          // score_1_10 null = subtopico salvo sem nota: carrega como NAO avaliado
          // (slider na base 5, mas a UI mostra "Sem nota" e fica fora do calculo).
          const hasScore = row.score_1_10 != null;
          next[row.category as BonusEvaluationCategory][row.subtopic] = {
            score: hasScore ? Number(row.score_1_10) : 5,
            scored: hasScore,
            justificativa: justParsed.text,
            justificativa_chips: justParsed.chips,
            pontos_de_melhoria: melhoraParsed.text,
            pontos_de_melhoria_chips: melhoraParsed.chips,
          };
        });

        if (!cancelled) { setForm(next); setTouched(false); }
      } catch (error: any) {
        if (!cancelled) {
          setForm(buildDefaultState());
          setLoadedRowCount(0);
          setTouched(false);
          notifyError(error, {
            context: "bonus-eval-load",
            message: "Não foi possível carregar a avaliação do período. Os campos foram reiniciados — tente novamente em instantes.",
          });
        }
      } finally {
        if (!cancelled) setLoadingPeriod(false);
      }
    };

    void loadPeriod();
    return () => { cancelled = true; };
  }, [consultant, open, periodMonth, periodYear, session?.userId]);

  const summary = useMemo(() => {
    const calc = (cat: BonusEvaluationCategory) => {
      // So entram no calculo os subtopicos efetivamente avaliados; sem nenhum, fica pendente.
      const entries = Object.values(form[cat]).filter((i) => i.scored);
      const avg = averageNumbers(entries.map((i) => i.score * 10));
      const payout = getBonusCategoryPayoutFromScore(cat, avg, consultant?.level ?? null);
      return { average: avg, payout };
    };
    return { hard: calc("hard_skill_manual"), soft: calc("soft_skill"), people: calc("people_skill") };
  }, [consultant?.level, form]);

  const updateField = useCallback(
    (category: BonusEvaluationCategory, subtopic: string, patch: Partial<SubtopicValue>) => {
      setTouched(true);
      // Definir a nota marca o subtopico como avaliado.
      const withScored = "score" in patch ? { ...patch, scored: true } : patch;
      setForm((cur) => ({
        ...cur,
        [category]: { ...cur[category], [subtopic]: { ...cur[category][subtopic], ...withScored } },
      }));
    },
    [],
  );

  const handleSave = async (status: BonusEvaluationStatus) => {
    if (!consultant?.userId || !session?.userId) return;
    if (!hasPermission) { toast.error("Você não tem permissão para esta ação."); return; }
    // Evita "salvar" uma avaliacao que o usuario nunca preencheu: o form inicia com
    // notas 5 pre-setadas. Se nao havia avaliacao no banco e nada foi alterado, barra.
    if (loadedRowCount === 0 && !touched) {
      toast.warning("Preencha ao menos uma nota antes de salvar ou enviar a avaliação.");
      return;
    }
    setSaving(true);
    try {
      const rows = categoryKeys.flatMap((category) =>
        Object.entries(form[category]).map(([subtopic, value]) => {
          // Subtopico nao avaliado (scored=false) NAO pode gravar a nota base 5: isso
          // contaminava a media do coordenador e fazia o item reaparecer como avaliado.
          // Gravamos score_1_10 = null para que o leitor (useBonusRealData) o ignore.
          const isScored = value.scored;
          return {
            evaluation_scope: "consultant",
            period_type: "month",
            period_key: periodKey,
            period_month: periodMonth,
            period_year: periodYear,
            user_id: consultant.userId,
            evaluator_user_id: session.userId,
            category,
            subtopic,
            score_1_10: isScored ? value.score : null,
            justificativa: composeField(value.justificativa_chips ?? [], value.justificativa),
            pontos_de_melhoria: composeField(value.pontos_de_melhoria_chips ?? [], value.pontos_de_melhoria),
            soft_skill_score: isScored && category === "soft_skill" ? value.score * 10 : null,
            people_skill_score: isScored && category === "people_skill" ? value.score * 10 : null,
            notes: composeField(value.justificativa_chips ?? [], value.justificativa),
            source_provenance: "manual",
            source_form: "bonus_evaluation_modal",
            status,
            submitted_at: new Date().toISOString(),
          };
        }),
      );

      // Atomic save: upsert on the consultant identity unique index
      // (period_year, period_month, user_id, evaluator_user_id, category, subtopic).
      // The form always emits the full fixed set of category×subtopic rows, so every
      // existing row for this evaluation is overwritten — no delete-then-insert window
      // that could lose data if the write fails midway.
      const { error } = await supabase
        .from("bonus_internal_evaluations")
        .upsert(rows, {
          onConflict: "period_year,period_month,user_id,evaluator_user_id,category,subtopic",
        });
      if (error) throw error;

      if (status === "submitted") {
        const { error: notificationError } = await supabase
          .from("bonus_evaluation_notifications")
          .upsert({
            user_id: consultant.userId,
            evaluator_user_id: session.userId,
            period_key: periodKey,
            period_month: periodMonth,
            period_year: periodYear,
            message: "Você recebeu uma nova avaliação.",
            read_at: null,
            opened_at: null,
          }, { onConflict: "user_id,evaluator_user_id,period_key" });
        if (notificationError) throw notificationError;
      }

      setLoadedRowCount(rows.length);
      toast.success(status === "submitted" ? "Avaliação finalizada e salva." : "Rascunho salvo com sucesso.");
      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      notifyError(error, { context: "bonus-eval-save", hint: "save" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!consultant?.userId || !session?.userId) return;
    if (!hasPermission) {
      toast.error("Você não tem permissão para esta ação.");
      return;
    }
    if (!loadedRowCount) return;
    setConfirmDeleteOpen(true);
  };

  const doDelete = async () => {
    if (!consultant?.userId || !session?.userId) return;
    setConfirmDeleteOpen(false);
    setSaving(true);
    try {
      const { error } = await supabase
        .from("bonus_internal_evaluations")
        .delete()
        .eq("evaluation_scope", "consultant")
        .eq("period_year", periodYear)
        .eq("period_month", periodMonth)
        .eq("user_id", consultant.userId)
        .eq("evaluator_user_id", session.userId);

      if (error) throw error;

      setForm(buildDefaultState());
      setLoadedRowCount(0);
      toast.success("Avaliação excluída com sucesso.");
      onSaved?.();
    } catch (error) {
      notifyError(error, { context: "bonus-eval-delete", hint: "save" });
    } finally {
      setSaving(false);
    }
  };

  /* ── Progress indicator per category ──────────────────────────────── */
  const filledCount = useCallback(
    (cat: BonusEvaluationCategory) => {
      // Conta subtopicos que ja receberam nota (o badge reflete o progresso da avaliacao).
      return Object.values(form[cat]).filter((v) => v.scored).length;
    },
    [form],
  );

  /* ── Permission check ─────────────────────────────────────────────────
     SOMENTE o coordenador direto do colaborador pode avaliar (vinculo explicito
     em user_coordinator_links). Acesso full (admin / payment manager) VE tudo
     — ranking, payouts, relatorios — mas NAO avalia quem nao coordena.
  ── */
  const hasPermission = useMemo(() => {
    if (!consultant?.userId || !session?.userId) return false;
    return (session?.coordinatorOf ?? []).includes(consultant.userId);
  }, [consultant?.userId, session?.coordinatorOf, session?.userId]);

  const responsibleCoordinatorName = consultant?.coordinatorName ?? null;

  if (!open) return null;

  if (!hasPermission) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm p-0 overflow-hidden border-border/10 bg-[linear-gradient(180deg,hsl(224_35%_10%/0.99),hsl(229_33%_8%/0.99))] shadow-2xl shadow-black/50 sm:rounded-2xl rounded-none">
          {/* top accent stripe */}
          <div className="h-1 w-full bg-gradient-to-r from-destructive/60 via-destructive/40 to-destructive/10" />
          <div className="flex flex-col items-center gap-5 px-7 py-8 text-center">
            {/* icon */}
            <div className="relative flex h-14 w-14 items-center justify-center">
              <motion.div
                className="absolute inset-0 rounded-2xl bg-destructive/10 border border-destructive/15"
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              >
                <ShieldAlert className="relative h-6 w-6 text-destructive" />
              </motion.div>
            </div>

            {/* text block */}
            <div className="space-y-3">
              <DialogTitle className="text-base font-bold tracking-tight text-foreground">
                Avaliação não permitida
              </DialogTitle>
              <DialogDescription className="space-y-1.5 text-[13px] leading-relaxed text-muted-foreground/65">
                <span className="block">Você não é o coordenador responsável por este usuário.</span>
                <span className="block">Repasse esta avaliação para o coordenador responsável.</span>
              </DialogDescription>
              {/* coordinator name pill */}
              <div className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium ${
                responsibleCoordinatorName
                  ? "border-primary/20 bg-primary/[0.07] text-foreground/80"
                  : "border-border/15 bg-card/30 text-muted-foreground/45 italic"
              }`}>
                {responsibleCoordinatorName
                  ? <>
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                      Coordenador responsável: <span className="font-semibold text-foreground/90">{responsibleCoordinatorName}</span>
                    </>
                  : "Coordenador responsável não identificado."}
              </div>
            </div>

            {/* close button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="w-full rounded-xl border-border/15 bg-card/30 hover:bg-card/50 text-foreground/70 hover:text-foreground transition-colors"
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[100dvh] sm:max-h-[92vh] w-full sm:w-[95vw] max-w-3xl overflow-hidden border-white/[0.06] bg-[linear-gradient(180deg,hsl(224_35%_10%/0.98),hsl(229_33%_8%/0.98))] p-0 shadow-2xl shadow-black/50 flex flex-col sm:rounded-lg rounded-none">

        {/* ── Header ───────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-border/8">
          {/* Top hero strip */}
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="relative overflow-hidden px-5 pt-5 pb-4 sm:px-7 sm:pt-6 sm:pb-5"
          >
            {/* Decorative gradient glow */}
            <div className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 h-32 w-72 rounded-full bg-primary/[0.06] blur-3xl" />

            <DialogHeader className="relative z-10 flex flex-col items-center text-center space-y-2">
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.08, duration: 0.4, ease: "easeOut" }}
                className="relative flex h-12 w-12 items-center justify-center"
              >
                {/* Outer glow pulse ring */}
                <motion.div
                  className="absolute inset-0 rounded-2xl border border-primary/10"
                  animate={{
                    boxShadow: [
                      "0 0 0px 0px hsl(var(--primary) / 0.0)",
                      "0 0 12px 3px hsl(var(--primary) / 0.12)",
                      "0 0 0px 0px hsl(var(--primary) / 0.0)",
                    ],
                    opacity: [0.6, 1, 0.6],
                  }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                />
                {/* Inner container */}
                <motion.div
                  className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 border border-primary/15 backdrop-blur-sm"
                  animate={{ opacity: [0.85, 1, 0.85] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                >
                  <ClipboardCheck className="h-5 w-5 text-primary drop-shadow-[0_0_3px_hsl(var(--primary)/0.25)]" />
                </motion.div>
              </motion.div>
              <div className="space-y-0.5 text-center">
                <DialogTitle className="text-base font-bold tracking-tight text-foreground sm:text-lg">
                  Avaliação de Desempenho
                </DialogTitle>
                <DialogDescription className="text-[13px] text-muted-foreground/50 leading-snug">
                  <span className="font-medium text-foreground/70">{consultant?.name ?? "Consultor"}</span>
                  <span className="mx-1.5 text-border/30">·</span>
                  Avalie cada critério com nota e justificativa
                </DialogDescription>
              </div>
            </DialogHeader>
          </motion.div>

          {/* Period selector — centered strip */}
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.35, ease: "easeOut" }}
            className="flex items-center justify-center gap-2 border-t border-border/6 bg-white/[0.015] px-4 py-3 sm:py-3.5"
          >
            {/* Grouped pill container */}
            <div className="inline-flex items-center gap-2.5 rounded-2xl border border-border/8 bg-white/[0.02] px-4 py-2 shadow-[0_1px_4px_rgba(0,0,0,0.15)]">
              <Calendar className="h-3.5 w-3.5 text-primary/50" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/40 select-none">
                Período
              </span>

              <div className="mx-0.5 h-4 w-px bg-border/10" />

              <Select value={String(periodMonth)} onValueChange={(v) => setPeriodMonth(Number(v))}>
                <SelectTrigger className="h-7 w-[110px] gap-1 rounded-lg border-0 bg-white/[0.04] px-2.5 text-xs font-semibold text-foreground/85 shadow-none ring-1 ring-border/8 transition-all duration-150 hover:bg-white/[0.07] hover:ring-border/18 focus:ring-1 focus:ring-primary/25 data-[state=open]:ring-primary/30 data-[state=open]:bg-white/[0.06] [&>svg]:shrink-0 [&>svg]:ml-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  className="min-w-[120px] rounded-xl border border-border/12 bg-[hsl(228_30%_11%/0.98)] p-1 shadow-xl shadow-black/40 backdrop-blur-sm animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-1"
                >
                  {monthOptions.map((m) => (
                    <SelectItem
                      key={m.value}
                      value={String(m.value)}
                      className="rounded-lg pl-3 pr-3 py-2 text-xs font-medium text-foreground/70 transition-colors cursor-pointer data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary data-[state=checked]:text-primary data-[state=checked]:font-semibold [&>span:first-child]:hidden"
                    >
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={String(periodYear)} onValueChange={(v) => setPeriodYear(Number(v))}>
                <SelectTrigger className="h-7 w-[76px] gap-1 rounded-lg border-0 bg-white/[0.04] px-2.5 text-xs font-semibold text-foreground/85 shadow-none ring-1 ring-border/8 transition-all duration-150 hover:bg-white/[0.07] hover:ring-border/18 focus:ring-1 focus:ring-primary/25 data-[state=open]:ring-primary/30 data-[state=open]:bg-white/[0.06]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  className="min-w-[100px] rounded-xl border border-border/12 bg-[hsl(228_30%_11%/0.98)] p-1 shadow-xl shadow-black/40 backdrop-blur-sm animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-1"
                >
                  {yearOptions.map((y) => (
                    <SelectItem
                      key={y}
                      value={String(y)}
                      className="rounded-lg pl-3 pr-3 py-2 text-xs font-medium text-foreground/70 transition-colors cursor-pointer data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary data-[state=checked]:text-primary data-[state=checked]:font-semibold [&>span:first-child]:hidden"
                    >
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {loadingPeriod && (
              <span className="text-[11px] text-muted-foreground/40 animate-pulse">Carregando...</span>
            )}
          </motion.div>
        </div>

        {/* ── Scrollable body ──────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-white/10 px-4 py-4 sm:px-6 sm:py-5">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as BonusEvaluationCategory)} className="space-y-4 sm:space-y-5">
            <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-2xl bg-white/[0.02] p-1.5 border border-border/6">
              {categoryKeys.map((cat) => {
                const total = BONUS_EVALUATION_CATEGORIES[cat].subtopics.length;
                const done = filledCount(cat);
                return (
                  <TabsTrigger
                    key={cat}
                    value={cat}
                    className="relative rounded-xl text-[11px] py-2.5 sm:text-xs sm:py-2.5 font-semibold tracking-tight transition-all data-[state=active]:bg-primary/12 data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:shadow-primary/5 data-[state=inactive]:text-muted-foreground/50 data-[state=inactive]:hover:text-muted-foreground/70"
                  >
                    {CAT_PT[cat]}
                    <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-white/[0.04] px-1 text-[9px] font-medium tabular-nums text-muted-foreground/35 data-[state=active]:bg-primary/10 data-[state=active]:text-primary/60">
                      {done}/{total}
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {categoryKeys.map((cat) => (
              <TabsContent key={cat} value={cat} className="mt-0 space-y-2">
                {BONUS_EVALUATION_CATEGORIES[cat].subtopics.map((sub) => (
                  <SubtopicCard
                    key={sub.key}
                    subtopicKey={sub.key}
                    label={sub.label}
                    description={sub.description}
                    value={form[cat][sub.key]}
                    isOpen={expandedKey === sub.key}
                    onToggle={() => setExpandedKey(expandedKey === sub.key ? null : sub.key)}
                    onChange={(patch) => updateField(cat, sub.key, patch)}
                  />
                ))}
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* ── Sticky footer ────────────────────────────────────── */}
        <div className="shrink-0 border-t border-border/6 bg-[hsl(229_33%_8%/0.97)] px-4 py-3.5 sm:px-6 sm:py-4">
          {/* Mini summary */}
          <div className="grid grid-cols-3 gap-2 mb-3.5">
            {([
              { key: "hard" as const, label: "Técnicas" },
              { key: "soft" as const, label: "Comportam." },
              { key: "people" as const, label: "Interpessoais" },
            ]).map(({ key, label }) => (
              <div key={key} className="rounded-xl border border-border/6 bg-white/[0.018] px-2.5 py-2.5 text-center">
                <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/35">{label}</p>
                <p className="mt-0.5 text-base font-bold text-foreground tabular-nums leading-none">{Math.round(summary[key].average ?? 0)}<span className="text-[10px] font-normal text-muted-foreground/30 ml-0.5">pts</span></p>
                <p className="mt-1 text-[10px] text-muted-foreground/30">≈ R$ {summary[key].payout ?? 0}</p>
              </div>
            ))}
          </div>

          <div className="mt-2 flex items-center gap-3 rounded-2xl border border-border/8 bg-white/[0.02] px-4 py-3 shadow-[0_-2px_12px_rgba(0,0,0,0.15)]">
            {loadedRowCount > 0 && (
              <Button
                variant="outline"
                size="default"
                onClick={handleDelete}
                disabled={saving}
                className="rounded-xl border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive gap-2 text-sm"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Excluir
              </Button>
            )}
            <Button variant="outline" size="default" onClick={() => handleSave("draft")} disabled={saving} className="flex-1 rounded-xl border-border/10 hover:bg-white/[0.04] gap-2 text-sm">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar rascunho
            </Button>
            <Button size="default" onClick={() => handleSave("submitted")} disabled={saving} className="flex-1 rounded-xl gap-2 text-sm">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
              Finalizar e enviar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Confirmação de exclusão — substitui o window.confirm nativo */}
    <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
      <DialogContent className="max-w-sm border-red-500/20 bg-[linear-gradient(180deg,hsl(224_35%_10%/0.99),hsl(229_33%_8%/0.99))] sm:rounded-2xl">
        <DialogHeader className="space-y-2">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10">
            <Trash2 className="h-5 w-5 text-red-400" />
          </div>
          <DialogTitle className="text-center text-base font-bold text-foreground">Excluir avaliação?</DialogTitle>
          <DialogDescription className="text-center text-[13px] leading-relaxed text-muted-foreground/70">
            A avaliação de <span className="font-semibold text-foreground/85">{consultant?.name}</span> do período{" "}
            <span className="font-semibold text-foreground/85">{periodKey}</span> será removida. Esta ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 flex gap-2">
          <Button variant="outline" size="default" onClick={() => setConfirmDeleteOpen(false)} disabled={saving} className="flex-1 rounded-xl border-border/15 text-sm">
            Cancelar
          </Button>
          <Button variant="destructive" size="default" onClick={() => void doDelete()} disabled={saving} className="flex-1 rounded-xl gap-2 text-sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Excluir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
