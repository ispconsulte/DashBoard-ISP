import { useEffect, useMemo, useState } from "react";
import {
  FileText, Loader2, Calendar, Mail, MessageSquare, SendHorizonal,
  User, Trophy, Clock, TrendingUp, ChevronDown, Award, Search, Download, ShieldAlert,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabaseExt as supabase } from "@/lib/supabase";
import type { BonusConsultantCard } from "@/modules/sprint6/hooks/useBonusRealData";
import type { AuthSession } from "@/modules/auth/hooks/useAuth";
import { toast } from "sonner";
import { money } from "./BonusHelpers";
import { SUPABASE_URL } from "@/lib/supabase";
import { exportBonusReportPdf, type BonusPdfData } from "@/lib/exportBonusPdf";

/* ── Pretty category/subtopic labels ────────────────────────────────── */
const CATEGORY_PT: Record<string, string> = {
  hard_skill_manual: "Competências Técnicas",
  soft_skill: "Competências Comportamentais",
  people_skill: "Competências Interpessoais",
};

const SUBTOPIC_PT: Record<string, string> = {
  qualidade_tecnica: "Qualidade técnica",
  conformidade_documental: "Conformidade documental",
  organizacao_evidencias: "Organização de evidências",
  organizacao: "Organização",
  proatividade: "Proatividade",
  comunicacao: "Comunicação",
  responsabilidade: "Responsabilidade",
  trabalho_equipe: "Trabalho em equipe",
  relacionamento_cliente: "Relacionamento com cliente",
  receptividade_feedback: "Receptividade a feedback",
};

function prettyLabel(rawLabel: string): { category: string; subtopic: string } {
  const [cat, sub] = rawLabel.split(" · ");
  return {
    category: CATEGORY_PT[cat ?? ""] ?? cat ?? "",
    subtopic: SUBTOPIC_PT[sub ?? ""] ?? sub ?? "",
  };
}

function scoreDot(score: number) {
  if (score >= 8) return "bg-emerald-500";
  if (score >= 5) return "bg-amber-500";
  return "bg-red-500";
}

/* ── Evaluation detail accordion ────────────────────────────────────── */
function EvalDetailCard({
  item,
  isOpen,
  onToggle,
}: {
  item: { label: string; score: number; justificativa: string; pontos: string };
  isOpen: boolean;
  onToggle: () => void;
}) {
  const { subtopic } = prettyLabel(item.label);
  // Short preview for collapsed state
  const preview = item.justificativa
    ? item.justificativa.length > 60
      ? item.justificativa.slice(0, 60).trimEnd() + "…"
      : item.justificativa
    : null;

  return (
    <div className="rounded-xl border border-border/6 bg-white/[0.015] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.02]"
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${scoreDot(item.score)}`} />
        <div className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-foreground">{subtopic}</span>
          {!isOpen && preview && (
            <span className="block truncate text-[10px] text-muted-foreground/40 mt-0.5">{preview}</span>
          )}
        </div>
        <span className="shrink-0 rounded-md border border-border/10 bg-white/[0.03] px-1.5 py-0.5 text-[10px] font-bold text-foreground tabular-nums">
          {item.score}/10
        </span>
        <ChevronDown className={`h-3 w-3 text-muted-foreground/35 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/5 px-3.5 py-3 space-y-2">
              {item.justificativa && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground/50 mb-0.5">Justificativa</p>
                  <p className="text-[11px] leading-relaxed text-foreground/80">{item.justificativa}</p>
                </div>
              )}
              {item.pontos && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground/50 mb-0.5">Pontos de melhoria</p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground/65">{item.pontos}</p>
                </div>
              )}
              {!item.justificativa && !item.pontos && (
                <p className="text-[11px] italic text-muted-foreground/40">Sem comentários registrados para este critério.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Category group header ──────────────────────────────────────────── */
function CategoryGroupHeader({ name, items }: { name: string; items: Array<{ score: number }> }) {
  const avg = items.length > 0
    ? Math.round(items.reduce((s, i) => s + i.score, 0) / items.length * 10)
    : 0;
  return (
    <div className="flex items-center justify-between px-0.5">
      <p className="text-[11px] font-semibold text-muted-foreground/55">{name}</p>
      <span className="text-[10px] font-medium text-muted-foreground/40 tabular-nums">
        Média {avg}/100
      </span>
    </div>
  );
}

/* ── Main modal ─────────────────────────────────────────────────────── */
export function BonusMonthlyReportModal({
  open,
  consultant,
  session,
  hideMonetary = false,
  onOpenChange,
  onSent,
}: {
  open: boolean;
  consultant: BonusConsultantCard | null;
  session: AuthSession | null;
  hideMonetary?: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: () => void;
}) {
  const [coordinatorMessage, setCoordinatorMessage] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState("");
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewRows, setPreviewRows] = useState<Array<{ label: string; score: number; justificativa: string; pontos: string }>>([]);
  const [previewSummary, setPreviewSummary] = useState<{
    score: number;
    payout: number;
    onTimeRate: number;
    hard: number;
    soft: number;
    people: number;
  } | null>(null);
  const [expandedEval, setExpandedEval] = useState<string | null>(null);
  const [evalSearch, setEvalSearch] = useState("");

  const monthLabel = `${String(month).padStart(2, "0")}/${year}`;
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

  useEffect(() => {
    const defaultEmail = consultant?.email ?? session?.email ?? "";
    setRecipientEmail(defaultEmail);
    setSelectedRecipient(defaultEmail || "__custom__");
    setCoordinatorMessage("");
    const latestPeriod = consultant?.manualEvaluation.periodKey;
    if (latestPeriod) {
      const [nextYear, nextMonth] = latestPeriod.split("-").map(Number);
      if (nextYear && nextMonth) {
        setYear(nextYear);
        setMonth(nextMonth);
      }
    }
  }, [consultant, session?.email]);

  const recipientOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: string[] = [];
    [consultant?.email ?? null, session?.email ?? null].forEach((email) => {
      const normalized = String(email ?? "").trim();
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      options.push(normalized);
    });
    return options;
  }, [consultant?.email, session?.email]);

  useEffect(() => {
    if (!open || !consultant?.userId) return;
    let cancelled = false;

    const loadPreview = async () => {
      setPreviewLoading(true);
      try {
        const periodKey = `${year}-${String(month).padStart(2, "0")}`;
        const [{ data: snapshotRows, error: snapshotError }, { data: evaluationRows, error: evaluationError }] = await Promise.all([
          supabase
            .from("bonus_score_snapshots")
            .select("score, payout_amount")
            .eq("snapshot_kind", "consultant_monthly")
            .eq("period_key", periodKey)
            .eq("user_id", consultant.userId)
            .limit(1),
          supabase
            .from("bonus_internal_evaluations")
            .select("category, subtopic, score_1_10, justificativa, pontos_de_melhoria, status")
            .eq("evaluation_scope", "consultant")
            .eq("user_id", consultant.userId)
            .eq("period_month", month)
            .eq("period_year", year)
            .order("category")
            .order("subtopic"),
        ]);

        if (snapshotError) throw snapshotError;
        if (evaluationError) throw evaluationError;

        const rows = (evaluationRows ?? [])
          .filter((row: { status: string | null }) => row.status !== "draft")
          .map((row: { category: string | null; subtopic: string | null; score_1_10: number | null; justificativa: string | null; pontos_de_melhoria: string | null }) => ({
            label: `${row.category ?? "categoria"} · ${row.subtopic ?? "subtópico"}`,
            score: Number(row.score_1_10 ?? 0),
            justificativa: row.justificativa ?? "",
            pontos: row.pontos_de_melhoria ?? "",
          }));

        const hardRows = rows.filter((row) => row.label.startsWith("hard_skill_manual"));
        const softRows = rows.filter((row) => row.label.startsWith("soft_skill"));
        const peopleRows = rows.filter((row) => row.label.startsWith("people_skill"));
        const avg = (items: typeof rows) => items.length ? Math.round((items.reduce((sum, item) => sum + item.score, 0) / items.length) * 10) : 0;

        if (!cancelled) {
          setPreviewRows(rows);
          setPreviewSummary({
            score: Number(snapshotRows?.[0]?.score ?? consultant.score ?? 0),
            payout: Number(snapshotRows?.[0]?.payout_amount ?? consultant.payout ?? 0),
            onTimeRate: Number(consultant.onTimeRate ?? 0),
            hard: avg(hardRows),
            soft: avg(softRows),
            people: avg(peopleRows),
          });
        }
      } catch (error: any) {
        if (!cancelled) {
          setPreviewRows([]);
          setPreviewSummary({
            score: consultant.score ?? 0,
            payout: consultant.payout ?? 0,
            onTimeRate: Number(consultant.onTimeRate ?? 0),
            hard: Math.round(consultant.manualEvaluation.hardManualScore ?? 0),
            soft: Math.round(consultant.manualEvaluation.softSkillScore ?? 0),
            people: Math.round(consultant.manualEvaluation.peopleSkillScore ?? 0),
          });
          toast.error(error?.message ?? "Erro ao carregar preview do relatório.");
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    };

    void loadPreview();
    return () => { cancelled = true; };
  }, [consultant, month, open, year]);

  const permissionRole = session?.bonusRole ?? "consultor";
  const hasPermission = useMemo(() => {
    if (permissionRole === "admin") return true;
    if (permissionRole === "gestor" && consultant?.userId) {
      return (session?.coordinatorOf ?? []).includes(consultant.userId);
    }
    return false;
  }, [permissionRole, consultant?.userId, session?.coordinatorOf]);

  const sendReport = async () => {
    if (!consultant?.userId || !recipientEmail.trim() || !session?.accessToken) return;
    if (!hasPermission) { toast.error("Você não tem permissão para esta ação."); return; }
    setSending(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-bonus-monthly-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({
          consultantId: consultant.userId,
          month,
          year,
          coordinatorMessage,
          recipientEmail: recipientEmail.trim(),
          hideMonetary,
        }),
      });

      if (!res.ok) throw new Error("Falha ao enviar relatório mensal.");

      toast.success("Relatório enviado com sucesso.");
      onSent?.();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message ?? "Erro ao enviar relatório mensal.");
    } finally {
      setSending(false);
    }
  };

  /* ── Group preview rows by category ──────────────────────────────── */
  const groupedRows = useMemo(() => {
    const groups: Record<string, typeof previewRows> = {};
    for (const row of previewRows) {
      const { category } = prettyLabel(row.label);
      if (!groups[category]) groups[category] = [];
      groups[category].push(row);
    }
    return Object.entries(groups);
  }, [previewRows]);

  const scoreValue = previewSummary?.score ?? consultant?.score ?? 0;
  const payoutValue = previewSummary?.payout ?? consultant?.payout ?? 0;
  const onTimeValue = previewSummary?.onTimeRate ?? consultant?.onTimeRate ?? 0;

  const handleExportPdf = async () => {
    const pdfData: BonusPdfData = {
      consultantName: consultant?.name ?? "Consultor",
      evaluatorName: session?.name ?? session?.email ?? "Coordenador",
      monthLabel: `${String(month).padStart(2, "0")}/${year}`,
      overallScore: scoreValue,
      payoutAmount: payoutValue,
      hideMonetary,
      metrics: {
        onTimeRate: onTimeValue,
        hardSkill: previewSummary?.hard ?? Math.round(consultant?.manualEvaluation.hardManualScore ?? 0),
        softSkill: previewSummary?.soft ?? Math.round(consultant?.manualEvaluation.softSkillScore ?? 0),
        peopleSkill: previewSummary?.people ?? Math.round(consultant?.manualEvaluation.peopleSkillScore ?? 0),
      },
      evaluations: previewRows.map((row) => {
        const { category, subtopic } = prettyLabel(row.label);
        return {
          category,
          subtopic,
          score: row.score,
          justificativa: row.justificativa,
          pontosMelhoria: row.pontos,
        };
      }),
    };
    try {
      await exportBonusReportPdf(pdfData);
      toast.success("PDF exportado com sucesso.");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao exportar PDF.");
    }
  };

  if (!open) return null;

  if (!hasPermission) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm border-white/[0.06] bg-[linear-gradient(180deg,hsl(224_35%_10%/0.98),hsl(229_33%_8%/0.98))] p-8 text-center sm:rounded-lg">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 border border-destructive/15">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <DialogHeader className="space-y-1.5">
              <DialogTitle className="text-base font-bold text-foreground">Acesso restrito</DialogTitle>
              <p className="text-sm text-muted-foreground/60">
                Você não tem permissão para enviar relatórios deste consultor.
              </p>
            </DialogHeader>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="mt-2">
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[100dvh] sm:max-h-[92vh] w-full sm:w-[95vw] max-w-3xl overflow-hidden border-white/[0.06] bg-[linear-gradient(180deg,hsl(224_35%_10%/0.98),hsl(229_33%_8%/0.98))] p-0 shadow-2xl shadow-black/50 flex flex-col sm:rounded-2xl rounded-none">

        {/* ═══ HEADER ═══ */}
        <div className="shrink-0 border-b border-border/6">
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="relative overflow-hidden px-5 pt-5 pb-4 sm:px-7 sm:pt-6 sm:pb-5"
          >
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
                  <FileText className="h-5 w-5 text-primary drop-shadow-[0_0_3px_hsl(var(--primary)/0.25)]" />
                </motion.div>
              </motion.div>
              <div className="space-y-0.5 text-center">
                <DialogTitle className="text-base font-bold tracking-tight text-foreground sm:text-lg">
                  Relatório de Bonificação
                </DialogTitle>
                <p className="text-[13px] text-muted-foreground/50 leading-snug">
                  <span className="font-medium text-foreground/70">{consultant?.name ?? "Colaborador"}</span>
                  <span className="mx-1.5 text-border/30">·</span>
                  Revise as métricas e envie ao colaborador
                </p>
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
            <div className="inline-flex items-center gap-2.5 rounded-2xl border border-border/8 bg-white/[0.02] px-4 py-2 shadow-[0_1px_4px_rgba(0,0,0,0.15)]">
              <User className="h-3.5 w-3.5 text-muted-foreground/50" />
              <span className="text-xs font-semibold text-foreground/85">{consultant?.name ?? "Consultor"}</span>

              <div className="mx-0.5 h-4 w-px bg-border/10" />

              <Calendar className="h-3.5 w-3.5 text-primary/50" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/40 select-none">
                Período
              </span>

              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="h-7 w-[110px] gap-1 rounded-lg border-0 bg-white/[0.04] px-2.5 text-xs font-semibold text-foreground/85 shadow-none ring-1 ring-border/8 transition-all duration-150 hover:bg-white/[0.07] hover:ring-border/18 focus:ring-1 focus:ring-primary/25 data-[state=open]:ring-primary/30 data-[state=open]:bg-white/[0.06] [&>svg]:shrink-0 [&>svg]:ml-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="min-w-[120px] rounded-xl border border-border/12 bg-[hsl(228_30%_11%/0.98)] p-1 shadow-xl shadow-black/40 backdrop-blur-sm animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-1">
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

              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="h-7 w-[76px] gap-1 rounded-lg border-0 bg-white/[0.04] px-2.5 text-xs font-semibold text-foreground/85 shadow-none ring-1 ring-border/8 transition-all duration-150 hover:bg-white/[0.07] hover:ring-border/18 focus:ring-1 focus:ring-primary/25 data-[state=open]:ring-primary/30 data-[state=open]:bg-white/[0.06]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="min-w-[100px] rounded-xl border border-border/12 bg-[hsl(228_30%_11%/0.98)] p-1 shadow-xl shadow-black/40 backdrop-blur-sm animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-1">
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
            {previewLoading && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/35" />
            )}
          </motion.div>
        </div>

        {/* ── Scrollable body ──────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-white/10 px-4 py-4 sm:px-6 sm:py-5 space-y-5 sm:space-y-6">

          {/* ════════════════════════════════════════════════════════
              SEÇÃO 2 — Resumo da Bonificação
              ════════════════════════════════════════════════════════ */}

          {/* Metric cards row */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-4">
            <MetricCard icon={Clock} label="Entregas no prazo" value={`${onTimeValue}%`} color="blue" />
            <MetricCard
              icon={Award}
              label="Técnicas"
              sublabel="Hard Skills"
              value={`${previewSummary?.hard ?? Math.round(consultant?.manualEvaluation.hardManualScore ?? 0)}/100`}
              color="amber"
            />
            <MetricCard
              icon={TrendingUp}
              label="Comportamentais"
              sublabel="Soft Skills"
              value={`${previewSummary?.soft ?? Math.round(consultant?.manualEvaluation.softSkillScore ?? 0)}/100`}
              color="emerald"
            />
            <MetricCard
              icon={Trophy}
              label="Interpessoais"
              sublabel="People Skills"
              value={`${previewSummary?.people ?? Math.round(consultant?.manualEvaluation.peopleSkillScore ?? 0)}/100`}
              color="purple"
            />
          </div>

          {/* Hero score — Nota Geral */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.35 }}
            className="flex flex-col items-center gap-1.5 py-3"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/35">Nota Geral</p>
            <div className="relative flex h-[72px] w-[72px] items-center justify-center rounded-2xl border border-primary/15 bg-primary/8 shadow-[0_0_24px_hsl(var(--primary)/0.08)]">
              <span className="text-2xl font-extrabold text-primary tabular-nums">{scoreValue}%</span>
            </div>
            {!hideMonetary && (
              <p className="text-sm font-bold text-foreground/90 mt-1">{money(payoutValue)}</p>
            )}
          </motion.div>

          {/* Evaluation details — grouped by category */}
          {groupedRows.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 px-0.5 shrink-0">
                  Detalhamento das avaliações
                </p>
                <div className="relative max-w-[220px] w-full">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/30" />
                  <input
                    type="text"
                    value={evalSearch}
                    onChange={(e) => setEvalSearch(e.target.value)}
                    placeholder="Buscar critério..."
                    className="h-7 w-full rounded-lg border border-border/8 bg-white/[0.025] pl-7 pr-2.5 text-[11px] text-foreground placeholder:text-muted-foreground/30 outline-none transition-colors focus:border-primary/20 focus:ring-1 focus:ring-primary/15"
                  />
                </div>
              </div>
              {(() => {
                const searchLower = evalSearch.trim().toLowerCase();
                const filtered = searchLower
                  ? groupedRows.map(([catName, items]) => [catName, items.filter((item) => {
                      const { subtopic } = prettyLabel(item.label);
                      return subtopic.toLowerCase().includes(searchLower) || catName.toLowerCase().includes(searchLower);
                    })] as [string, typeof items]).filter(([, items]) => items.length > 0)
                  : groupedRows;

                if (filtered.length === 0) {
                  return (
                    <p className="text-[11px] text-muted-foreground/40 text-center py-3">
                      Nenhum critério encontrado.
                    </p>
                  );
                }

                return filtered.map(([catName, items]) => (
                  <div key={catName} className="space-y-1.5">
                    <CategoryGroupHeader name={catName} items={items} />
                    {items.map((item) => (
                      <EvalDetailCard
                        key={item.label}
                        item={item}
                        isOpen={expandedEval === item.label}
                        onToggle={() => setExpandedEval(expandedEval === item.label ? null : item.label)}
                      />
                    ))}
                  </div>
                ));
              })()}
            </section>
          )}

          {!previewLoading && previewRows.length === 0 && (
            <div className="rounded-2xl border border-border/6 bg-white/[0.015] px-4 py-8 text-center">
              <FileText className="mx-auto h-5 w-5 text-muted-foreground/20 mb-2.5" />
              <p className="text-xs font-medium text-muted-foreground/45">Nenhuma avaliação para {monthLabel}</p>
              <p className="text-[10px] text-muted-foreground/28 mt-1">Submeta a avaliação antes de gerar o relatório.</p>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════
              SEÇÃO 3 — Mensagem e Envio
              ════════════════════════════════════════════════════════ */}
          <div className="rounded-2xl border border-border/6 bg-white/[0.012] p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground/35" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/40">
                Mensagem e Envio
              </p>
            </div>

            {/* Message */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-muted-foreground/50">
                Comentário do coordenador <span className="text-muted-foreground/25">(opcional)</span>
              </span>
              <Textarea
                rows={3}
                value={coordinatorMessage}
                onChange={(e) => setCoordinatorMessage(e.target.value)}
                placeholder="Mensagem personalizada para o colaborador..."
                className="resize-none rounded-xl border-border/6 bg-white/[0.02] text-sm placeholder:text-muted-foreground/25 focus-visible:ring-1 focus-visible:ring-primary/20"
              />
            </div>

            {/* Recipient */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-muted-foreground/50 flex items-center gap-1.5">
                <Mail className="h-3 w-3" /> Destinatário
              </span>
              <div className="space-y-2">
                {recipientOptions.length > 0 && (
                  <Select
                    value={selectedRecipient}
                    onValueChange={(v) => {
                      setSelectedRecipient(v);
                      if (v !== "__custom__") setRecipientEmail(v);
                      else setRecipientEmail("");
                    }}
                  >
                    <SelectTrigger className="rounded-lg border-border/8 bg-white/[0.03] text-sm">
                      <SelectValue placeholder="Selecione um e-mail" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/12 bg-[hsl(228_30%_11%/0.98)] p-1 shadow-xl shadow-black/40 backdrop-blur-sm">
                      {recipientOptions.map((email) => (
                        <SelectItem key={email} value={email} className="rounded-lg pl-8 pr-3 py-2 text-xs">{email}</SelectItem>
                      ))}
                      <SelectItem value="__custom__" className="rounded-lg pl-8 pr-3 py-2 text-xs">✏️ Digitar outro e-mail</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {(selectedRecipient === "__custom__" || recipientOptions.length === 0) && (
                  <Input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => {
                      setRecipientEmail(e.target.value);
                      setSelectedRecipient("__custom__");
                    }}
                    placeholder="novo-email@empresa.com"
                    className="rounded-lg border-border/8 bg-white/[0.03] text-sm placeholder:text-muted-foreground/25"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Sticky footer ──────────────────────────────────── */}
        <div className="shrink-0 border-t border-border/6 bg-[hsl(229_33%_8%/0.97)] px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3 rounded-2xl border border-border/8 bg-white/[0.02] px-4 py-3 shadow-[0_-2px_12px_rgba(0,0,0,0.15)]">
            <Button variant="outline" size="default" onClick={handleExportPdf} disabled={previewLoading || previewRows.length === 0} className="rounded-xl border-border/10 hover:bg-white/[0.04] gap-2 text-sm">
              <Download className="h-4 w-4" />
              Exportar PDF
            </Button>
            <div className="flex-1" />
            <Button variant="outline" size="default" onClick={() => onOpenChange(false)} className="rounded-xl border-border/10 hover:bg-white/[0.04] text-sm">
              Cancelar
            </Button>
            <Button size="default" onClick={sendReport} disabled={sending || !recipientEmail.trim()} className="rounded-xl gap-2 text-sm">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
              Enviar relatório
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Metric card sub-component ──────────────────────────────────────── */
function MetricCard({
  icon: Icon,
  label,
  sublabel,
  value,
  color,
}: {
  icon: typeof Clock;
  label: string;
  sublabel?: string;
  value: string;
  color: "blue" | "emerald" | "amber" | "purple";
}) {
  const colorMap = {
    blue: { border: "border-blue-500/10", bg: "bg-blue-500/[0.03]", icon: "text-blue-400", iconBg: "bg-blue-500/12" },
    emerald: { border: "border-emerald-500/10", bg: "bg-emerald-500/[0.03]", icon: "text-emerald-400", iconBg: "bg-emerald-500/12" },
    amber: { border: "border-amber-500/10", bg: "bg-amber-500/[0.03]", icon: "text-amber-400", iconBg: "bg-amber-500/12" },
    purple: { border: "border-purple-500/10", bg: "bg-purple-500/[0.03]", icon: "text-purple-400", iconBg: "bg-purple-500/12" },
  };
  const c = colorMap[color];

  return (
    <div className={`rounded-2xl border p-3.5 ${c.border} ${c.bg} transition-colors`}>
      <div className="flex items-center gap-1.5 mb-2.5">
        <div className={`flex h-5.5 w-5.5 items-center justify-center rounded-lg ${c.iconBg}`}>
          <Icon className={`h-3 w-3 ${c.icon}`} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/45 leading-tight truncate">{label}</p>
          {sublabel && <p className="text-[9px] text-muted-foreground/25 leading-tight">{sublabel}</p>}
        </div>
      </div>
      <p className="text-lg font-bold text-foreground/90 tabular-nums leading-none">{value}</p>
    </div>
  );
}
