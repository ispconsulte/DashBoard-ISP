import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Crown,
  Search,
  Target,
  TrendingUp,
  TrendingDown,
  PieChart,
  AlertCircle,
  Users,
  UserRound,
  FileText,
  Filter,
  X,
  BookOpen,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { usePageSEO } from "@/hooks/usePageSEO";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useBonusRealData, type BonusConsultantCard } from "@/modules/sprint6/hooks/useBonusRealData";
import { useSharedTasks } from "@/contexts/SharedTasksContext";
import type { RoiPeriod } from "@/modules/sprint6/types";
import PageSkeleton from "@/components/ui/PageSkeleton";
import DataErrorCard from "@/components/ui/DataErrorCard";
import { supabaseExt as supabase } from "@/lib/supabase";

import {
  money,
  normalizeName,
  periodLabel,
} from "@/modules/sprint6/components/bonus/BonusHelpers";
import {
  SectionCard,
  InsightRow,
  EmptyInsight,
  ScoreDistribution,
} from "@/modules/sprint6/components/bonus/BonusSharedCards";
import { RankingCard } from "@/modules/sprint6/components/bonus/BonusRankingCard";
import { BonusEvaluationModal } from "@/modules/sprint6/components/bonus/BonusEvaluationModal";
import { BonusMonthlyReportModal } from "@/modules/sprint6/components/bonus/BonusMonthlyReportModal";
import { BonusTrendsSection } from "@/modules/sprint6/components/bonus/BonusTrendsSection";
import { BonusScoreComposition } from "@/modules/sprint6/components/bonus/BonusScoreComposition";
import { CollapsibleSection } from "@/modules/sprint6/components/bonus/CollapsibleSection";
import { BonusTeamTab } from "@/modules/sprint6/components/bonus/BonusTeamTab";
import { BonusUserDetail } from "@/modules/sprint6/components/bonus/BonusUserDetail";
import { BonusGuideTab } from "@/modules/sprint6/components/bonus/BonusGuideTab";

/* ── Visibility tiers — driven by session permissions, no hardcoded names ─── */

/* ── Period options ──────────────────────────────────────────────── */
const PERIOD_OPTIONS: { value: RoiPeriod; label: string }[] = [
  { value: "30d", label: "Mensal" },
  { value: "90d", label: "Trimestral" },
  { value: "180d", label: "Semestral" },
  { value: "all", label: "Histórico" },
];


export default function Sprint6BonificacaoPage() {
  usePageSEO("Bonificação | Dashboard ISP");
  const { session, loadingSession } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [period, setPeriod] = useState<RoiPeriod>("180d");
  const [filterOpen, setFilterOpen] = useState(false);
  const [consultantFilter, setConsultantFilter] = useState("");
  const [activeMainTab, setActiveMainTab] = useState("ranking");
  const [search, setSearch] = useState("");
  const [evaluationFilter, setEvaluationFilter] = useState<"all" | "evaluated" | "pending">("all");
  const [expandedConsultant, setExpandedConsultant] = useState<string | null>(null);
  const [evaluationConsultant, setEvaluationConsultant] = useState<BonusConsultantCard | null>(null);
  const [reportConsultant, setReportConsultant] = useState<BonusConsultantCard | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [bonusNoticeOpen, setBonusNoticeOpen] = useState(false);
  const bonus = useBonusRealData(period, session?.accessToken, refreshKey);
  const sharedTasks = useSharedTasks();
  const allTasks = sharedTasks?.tasks ?? [];

  // Track first successful load to prevent flickering empty/error states
  useEffect(() => {
    if (!bonus.loading && !hasLoadedOnce) {
      setHasLoadedOnce(true);
    }
  }, [bonus.loading, hasLoadedOnce]);

  // Payment manager: configured in bonus_settings table only — no role/name fallback
  const isFullAccessManager = session?.isPaymentManager === true;
  // Coordinators: any user who has subordinates linked in user_coordinator_links
  const canManageTeam = (session?.coordinatorOf ?? []).length > 0;
  // Ranking: payment manager only, or coordinator with actual subordinates
  // Role alone (admin/gestor) does not grant ranking — must have real supervised users
  const canSeeRanking = isFullAccessManager || canManageTeam;
  // All evaluations: payment manager only
  const canSeeAllEvaluations = isFullAccessManager;
  // Monetary (payout values): payment manager only — never exposed by role alone
  const hideMonetary = !isFullAccessManager;

  const visibleConsultants = useMemo(() => {
    if (canSeeAllEvaluations) return bonus.consultants;
    if (canManageTeam) {
      return bonus.consultants.filter((consultant) =>
        consultant.userId === session?.userId ||
        (consultant.userId ? (session?.coordinatorOf ?? []).includes(consultant.userId) : false),
      );
    }
    return bonus.consultants.filter((consultant) => consultant.userId === session?.userId);
  }, [bonus.consultants, canManageTeam, canSeeAllEvaluations, session?.coordinatorOf, session?.userId]);

  const myConsultant = useMemo(
    () => visibleConsultants.find((consultant) => consultant.userId === session?.userId) ?? visibleConsultants[0] ?? null,
    [visibleConsultants, session?.userId],
  );

  const pendingEvaluationNotification = useMemo(() => {
    if (!session?.userId) return null;
    return bonus.persistence.notifications.find((notification) =>
      String(notification.user_id) === String(session.userId) && !notification.opened_at,
    ) ?? null;
  }, [bonus.persistence.notifications, session?.userId]);

  // Payment manager sees all; coordinators see only their own subordinates in the ranking
  const rankingConsultants = useMemo(() => {
    if (!canSeeRanking) return [];
    if (isFullAccessManager) return bonus.consultants;
    return bonus.consultants.filter((consultant) =>
      consultant.userId != null && (session?.coordinatorOf ?? []).includes(consultant.userId),
    );
  }, [bonus.consultants, canSeeRanking, isFullAccessManager, session?.coordinatorOf]);

  const subordinateConsultants = useMemo(() => {
    if (!canManageTeam) return [];
    return bonus.consultants.filter((consultant) =>
      consultant.userId != null && (session?.coordinatorOf ?? []).includes(consultant.userId),
    );
  }, [bonus.consultants, canManageTeam, session?.coordinatorOf]);

  const pendingTeamEvaluationsCount = useMemo(
    () => subordinateConsultants.filter((consultant) => consultant.manualEvaluation.status !== "submitted").length,
    [subordinateConsultants],
  );

  const filteredConsultants = useMemo(() => {
    let result = rankingConsultants;
    const term = normalizeName(search);

    if (term) {
      result = result.filter((consultant) => normalizeName(consultant.name).includes(term));
    }

    if (evaluationFilter === "evaluated") {
      result = result.filter((consultant) => consultant.manualEvaluation.hasManualEvaluation);
    }

    if (evaluationFilter === "pending") {
      result = result.filter((consultant) => !consultant.manualEvaluation.hasManualEvaluation);
    }

    return result;
  }, [rankingConsultants, search, evaluationFilter]);

  const summaryConsultants = useMemo(
    () => canSeeRanking ? rankingConsultants : myConsultant ? [myConsultant] : [],
    [canSeeRanking, myConsultant, rankingConsultants],
  );
  const topPerformer = rankingConsultants.find((consultant) => consultant.scoreSource !== "none") ?? null;
  const needsAttention = useMemo(
    () => rankingConsultants.filter((consultant) => consultant.scoreSource !== "none" && consultant.score < 60).slice(0, 3),
    [rankingConsultants],
  );
  const trendingUp = useMemo(
    () => rankingConsultants.filter((consultant) => consultant.scoreSource !== "none" && consultant.score >= 75 && (consultant.onTimeRate == null || consultant.onTimeRate >= 60)).slice(0, 3),
    [rankingConsultants],
  );

  const totalHoursTracked = useMemo(
    () => summaryConsultants.reduce((sum, consultant) => sum + consultant.hoursTracked, 0),
    [summaryConsultants],
  );
  const totalCompletedTasks = useMemo(
    () => summaryConsultants.reduce((sum, consultant) => sum + consultant.completedTasks, 0),
    [summaryConsultants],
  );
  const totalTasks = useMemo(
    () => summaryConsultants.reduce((sum, consultant) => sum + consultant.totalTasks, 0),
    [summaryConsultants],
  );
  const completionRate = totalTasks > 0 ? Math.round((totalCompletedTasks / totalTasks) * 100) : 0;
  const hasActiveRankingFilters = search.trim().length > 0 || evaluationFilter !== "all";

  const hasOwnEvaluationTab = Boolean(myConsultant);
  const hasTeamTab = subordinateConsultants.length > 0;
  const bonusReminder = useMemo(() => {
    if (isFullAccessManager) {
      return {
        id: "full-cycle-review",
        title: "Lembrete: Revisão de Bonificação",
        message: "Revise o ciclo completo de bonificação, confira avaliações, ranking e relatórios antes do fechamento mensal.",
      };
    }

    if (pendingTeamEvaluationsCount > 0) {
      return {
        id: "team-evaluations",
        title: "Lembrete: Avaliação da Minha equipe",
        message: `${pendingTeamEvaluationsCount} membro${pendingTeamEvaluationsCount !== 1 ? "s" : ""} da sua equipe ainda ${pendingTeamEvaluationsCount !== 1 ? "precisam" : "precisa"} de avaliação neste período.`,
      };
    }

    if (pendingEvaluationNotification) {
      return {
        id: "own-evaluation",
        title: "Lembrete: Avaliação disponível",
        message: "Você recebeu uma avaliação pendente de leitura. Abra sua avaliação para revisar as notas do coordenador.",
      };
    }

    return null;
  }, [isFullAccessManager, pendingEvaluationNotification, pendingTeamEvaluationsCount]);

  const bonusReminderStorageKey = bonusReminder
    ? `ispconsulte:bonus-notice:${session?.userId ?? session?.email ?? "anon"}:${bonusReminder.id}`
    : null;

  useEffect(() => {
    if (!bonusReminder || !bonusReminderStorageKey) return;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(bonusReminderStorageKey) === "dismissed") return;
    setBonusNoticeOpen(true);
  }, [bonusReminder, bonusReminderStorageKey]);

  const dismissBonusNotice = useCallback(() => {
    if (bonusReminderStorageKey && typeof window !== "undefined") {
      window.localStorage.setItem(bonusReminderStorageKey, "dismissed");
    }
    setBonusNoticeOpen(false);
  }, [bonusReminderStorageKey]);

  const availableTabs = useMemo(() => {
    const tabs: string[] = [];
    if (canSeeRanking) tabs.push("ranking");
    if (canSeeAllEvaluations) tabs.push("all-evaluations");
    if (hasOwnEvaluationTab) tabs.push("own-evaluation");
    if (hasTeamTab) tabs.push("my-team");
    // Aba-guia "Como funciona": sempre por último e só para o responsável geral.
    if (isFullAccessManager) tabs.push("guide");
    return tabs;
  }, [canSeeAllEvaluations, canSeeRanking, hasOwnEvaluationTab, hasTeamTab, isFullAccessManager]);

  useEffect(() => {
    if (availableTabs.length === 0) return;
    if (!availableTabs.includes(activeMainTab)) {
      setActiveMainTab(availableTabs[0]);
    }
  }, [activeMainTab, availableTabs]);

  const waitingFirstSync =
    !bonus.loading && bonus.consultants.length === 0 && bonus.projects.length === 0 &&
    bonus.persistence.snapshotCount === 0 && bonus.persistence.sourceStatuses.length === 0;

  const noDataForPeriod =
    !bonus.loading && !waitingFirstSync && bonus.consultants.length === 0 &&
    bonus.projects.length === 0 && bonus.persistence.snapshotCount === 0;
  const noVisibleConsultantsForPermission =
    !bonus.loading && bonus.consultants.length > 0 && visibleConsultants.length === 0;
  const noOperationalConsultantsForPeriod =
    !bonus.loading && bonus.consultants.length === 0 && bonus.projects.length > 0;

  const statusBanner = waitingFirstSync
    ? { tone: "blue" as const, title: "Aguardando primeiro sync", message: `Sem carga inicial para ${periodLabel(period)}.` }
    : noDataForPeriod
    ? { tone: "amber" as const, title: "Sem dados no período", message: `Ajuste o período ou aguarde o próximo ciclo.` }
    : null;

  if (loadingSession || (bonus.loading && !hasLoadedOnce)) return <PageSkeleton variant="analiticas" />;

  if (!session?.accessToken) {
    return (
      <div className="page-gradient w-full">
        <div className="mx-auto w-full max-w-[1900px] p-4 sm:p-5 md:p-8">
          <DataErrorCard title="Sessão ainda não inicializada" message="Bonificação depende da sessão autenticada." />
        </div>
      </div>
    );
  }

  return (
    <div className="page-gradient w-full">
      <div className="mx-auto w-full max-w-[1800px] space-y-5 p-4 sm:p-5 md:p-6 lg:p-8">
        <div className="space-y-5">
          {/* Header */}
          <div
            className="relative overflow-hidden rounded-2xl ring-1 ring-inset ring-white/[0.06]"
            style={{
              background: "linear-gradient(135deg, hsl(224 48% 10%) 0%, hsl(244 46% 15%) 46%, hsl(38 50% 12%) 100%)",
            }}
          >
            <div className="relative flex flex-col gap-2 p-4 sm:p-5 md:px-6 md:py-5">
              <div className="flex items-center gap-3.5">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/20 shrink-0 backdrop-blur-sm shadow-lg shadow-black/30"
                  style={{
                    background: "linear-gradient(145deg, hsl(45 80% 30% / 0.5), hsl(45 60% 20% / 0.4))",
                  }}
                >
                  <Crown className="h-5 w-5 text-amber-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground tracking-tight leading-tight">
                    Bonificação
                  </h1>
                  <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground/55 line-clamp-1">
                    {isFullAccessManager ? "Visão completa · Ranking, desempenho e pagamentos" : canSeeRanking ? "Ranking, desempenho e evolução da equipe" : "Seu desempenho e sua avaliação mais recente"}
                  </p>
                </div>
                <div className="shrink-0">
                  <Popover open={filterOpen} onOpenChange={setFilterOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="flex items-center gap-2 rounded-xl border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white/90 transition-colors"
                      >
                        <Filter className="h-3.5 w-3.5 opacity-60" />
                        Filtros
                        {(period !== "180d" || consultantFilter) && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400/20 text-[10px] font-bold text-amber-400">
                            {[period !== "180d", !!consultantFilter].filter(Boolean).length}
                          </span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" sideOffset={8} className="w-[30rem] max-w-[95vw] rounded-2xl border-border/15 bg-card p-5 shadow-2xl backdrop-blur-xl space-y-5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-foreground">Filtros</p>
                        <button type="button" onClick={() => setFilterOpen(false)} className="text-muted-foreground/40 hover:text-foreground transition-colors">
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Period */}
                      <div className="space-y-2">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-semibold">Período</p>
                        <div className="flex flex-wrap gap-1.5">
                          {PERIOD_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setPeriod(opt.value)}
                              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                                period === opt.value
                                  ? "bg-primary text-primary-foreground shadow-sm"
                                  : "bg-secondary/50 text-muted-foreground border border-border/10 hover:bg-secondary"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Consultant filter (payment manager only) */}
                      {canSeeAllEvaluations && (
                        <div className="space-y-2">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-semibold">Consultor</p>
                          <Select value={consultantFilter || "__all__"} onValueChange={(v) => setConsultantFilter(v === "__all__" ? "" : v)}>
                            <SelectTrigger className="h-9 w-full rounded-xl border-border/15 bg-card/40 text-xs text-foreground hover:bg-card/55 focus:ring-0 focus:ring-offset-0 focus:border-primary/30">
                              <SelectValue placeholder="Todos os consultores" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border border-border/15 bg-[hsl(222_47%_11%)] shadow-2xl shadow-black/40 z-50">
                              <SelectItem value="__all__" className="text-xs text-muted-foreground/70 hover:text-foreground hover:bg-white/[0.05] rounded-lg cursor-pointer focus:bg-white/[0.05] focus:text-foreground">Todos os consultores</SelectItem>
                              {bonus.consultants.map((c) => (
                                <SelectItem key={c.userId ?? c.name} value={c.name} className="text-xs text-muted-foreground/70 hover:text-foreground hover:bg-white/[0.05] rounded-lg cursor-pointer focus:bg-white/[0.05] focus:text-foreground">{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Clear */}
                      {(period !== "180d" || consultantFilter) && (
                        <button
                          type="button"
                          onClick={() => { setPeriod("180d"); setConsultantFilter(""); }}
                          className="w-full rounded-lg border border-border/10 bg-secondary/20 py-2 text-xs font-semibold text-muted-foreground/60 hover:text-foreground/80 transition-colors"
                        >
                          Limpar filtros
                        </button>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Active filter summary */}
              {(period !== "180d" || consultantFilter) && (
                <p className="text-[11px] text-muted-foreground/40 pl-[3.375rem]">
                  {PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? "Semestral"}
                  {consultantFilter && ` · ${consultantFilter}`}
                </p>
              )}
            </div>
          </div>

          {bonus.error && !bonus.loading && (
            <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] px-5 py-4 text-sm text-amber-200 space-y-1">
              <p className="font-semibold">Parece que encontramos um problema</p>
              <p className="text-xs text-amber-200/70 leading-relaxed">
                Tente recarregar a página ou sair e entrar novamente no sistema. Se o problema persistir, entre em contato com nossa equipe de desenvolvimento e informe a situação.
              </p>
            </div>
          )}

          {!bonus.loading && statusBanner && (
            <div className={`rounded-xl border px-4 py-3 ${statusBanner.tone === "blue" ? "border-blue-500/15 bg-blue-500/[0.04] text-blue-200" : "border-amber-500/15 bg-amber-500/[0.04] text-amber-200"}`}>
              <p className="text-sm font-semibold">{statusBanner.title}</p>
              <p className="mt-0.5 text-xs opacity-70">{statusBanner.message}</p>
            </div>
          )}

          <div className="space-y-3">
            {summaryConsultants.length > 0 && (
              <div className={`grid min-w-0 gap-2.5 sm:gap-3 ${canSeeRanking ? (!hideMonetary ? "grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3") : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"}`}>
                {[
                  canSeeRanking && {
                    label: "Score médio",
                    value: summaryConsultants.some((consultant) => consultant.scoreSource !== "none")
                      ? `${Math.round(summaryConsultants.reduce((sum, consultant) => sum + (consultant.scoreSource !== "none" ? consultant.score : 0), 0) / summaryConsultants.filter((consultant) => consultant.scoreSource !== "none").length)}%`
                      : "Pendente",
                    sub: `score registrado · ${periodLabel(period)}`,
                    color: "border-primary/12 bg-primary/[0.04]",
                    valueColor: "text-primary",
                  },
                  !hideMonetary && {
                    label: "Payout total",
                    value: summaryConsultants.some((consultant) => consultant.payout != null)
                      ? money(summaryConsultants.reduce((sum, consultant) => sum + (consultant.payout ?? 0), 0))
                      : "Pendente",
                    sub: `payout registrado · ${periodLabel(period)}`,
                    color: "border-emerald-500/12 bg-emerald-500/[0.04]",
                    valueColor: "text-emerald-400",
                  },
                  {
                    label: "Tarefas concluídas",
                    value: `${totalCompletedTasks} de ${totalTasks}`,
                    sub: completionRate > 0 ? `${completionRate}% de conclusão · ${periodLabel(period)}` : `sem tarefas no período ${periodLabel(period)}`,
                    color: "border-blue-500/12 bg-blue-500/[0.04]",
                    valueColor: "text-blue-400",
                  },
                  {
                    label: "Horas em tarefas concluídas",
                    value: `${Math.round(totalHoursTracked)}h`,
                    sub: summaryConsultants.length > 0 ? `média de ${Math.round(totalHoursTracked / summaryConsultants.length || 0)}h/pessoa · ${periodLabel(period)}` : `nenhuma hora · ${periodLabel(period)}`,
                    color: "border-amber-500/12 bg-amber-500/[0.04]",
                    valueColor: "text-amber-400",
                  },
                  !canSeeRanking && {
                    label: "Meu Score",
                    value: myConsultant?.scoreSource !== "none" ? `${myConsultant?.score}%` : "Pendente",
                    sub: periodLabel(period),
                    color: "border-primary/12 bg-primary/[0.04]",
                    valueColor: "text-primary",
                  },
                ].filter(Boolean).map((item: any) => (
                  <div key={item.label} className={`min-w-0 rounded-xl border p-3 sm:p-3.5 ${item.color}`}>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">{item.label}</p>
                    <p className={`mt-1.5 text-lg font-bold leading-tight break-words ${item.valueColor}`}>{item.value}</p>
                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground/50">{item.sub}</p>
                  </div>
                ))}
              </div>
            )}

            {availableTabs.length > 0 ? (
              <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="min-w-0 space-y-4">
                <TabsList className="grid h-auto w-full grid-cols-1 gap-1 rounded-xl border border-white/[0.08] bg-[linear-gradient(135deg,hsl(224_42%_12%/0.72),hsl(236_38%_13%/0.58))] p-1 shadow-lg shadow-black/10 min-[430px]:grid-cols-2 lg:flex lg:w-full lg:flex-wrap lg:justify-center">
                  {canSeeRanking && (
                    <TabsTrigger
                      value="ranking"
                      className="min-w-0 justify-center rounded-lg px-3 py-2 text-xs font-semibold data-[state=active]:bg-primary/12 data-[state=active]:text-primary data-[state=inactive]:text-muted-foreground/60 sm:px-4"
                    >
                      <Crown className="h-3.5 w-3.5 mr-1.5" />
                      Ranking Geral
                    </TabsTrigger>
                  )}
                  {canSeeAllEvaluations && (
                    <TabsTrigger
                      value="all-evaluations"
                      className="min-w-0 justify-center rounded-lg px-3 py-2 text-xs font-semibold data-[state=active]:bg-primary/12 data-[state=active]:text-primary data-[state=inactive]:text-muted-foreground/60 sm:px-4"
                    >
                      <Users className="h-3.5 w-3.5 mr-1.5" />
                      Todas as Avaliações
                    </TabsTrigger>
                  )}
                  {hasOwnEvaluationTab && (
                    <TabsTrigger
                      value="own-evaluation"
                      className="min-w-0 justify-center rounded-lg px-3 py-2 text-xs font-semibold data-[state=active]:bg-primary/12 data-[state=active]:text-primary data-[state=inactive]:text-muted-foreground/60 sm:px-4"
                    >
                      <UserRound className="h-3.5 w-3.5 mr-1.5" />
                      Minha avaliação
                    </TabsTrigger>
                  )}
                  {hasTeamTab && (
                    <TabsTrigger
                      value="my-team"
                      className="min-w-0 justify-center rounded-lg px-3 py-2 text-xs font-semibold data-[state=active]:bg-primary/12 data-[state=active]:text-primary data-[state=inactive]:text-muted-foreground/60 sm:px-4"
                    >
                      <Users className="h-3.5 w-3.5 mr-1.5" />
                      Minha equipe
                    </TabsTrigger>
                  )}
                  {isFullAccessManager && (
                    <TabsTrigger
                      value="guide"
                      className="min-w-0 justify-center rounded-lg px-3 py-2 text-xs font-semibold data-[state=active]:bg-primary/12 data-[state=active]:text-primary data-[state=inactive]:text-muted-foreground/60 sm:px-4"
                    >
                      <BookOpen className="h-3.5 w-3.5 mr-1.5" />
                      Como funciona
                    </TabsTrigger>
                  )}
                </TabsList>

                {canSeeRanking && (
                  <TabsContent value="ranking" className="mt-0 space-y-3">
                    {renderRankingContent()}
                  </TabsContent>
                )}

                {canSeeAllEvaluations && (
                  <TabsContent value="all-evaluations" className="mt-0">
                    <BonusTeamTab
                      subordinates={bonus.consultants}
                      session={session}
                      periodLabel={periodLabel(period)}
                      onEvaluate={setEvaluationConsultant}
                      onSendReport={setReportConsultant}
                    />
                  </TabsContent>
                )}

                {hasOwnEvaluationTab && (
                  <TabsContent value="own-evaluation" className="mt-0 space-y-3">
                    {renderOwnContent()}
                  </TabsContent>
                )}

                {hasTeamTab && (
                  <TabsContent value="my-team" className="mt-0">
                    <BonusTeamTab
                      subordinates={subordinateConsultants}
                      session={session}
                      periodLabel={periodLabel(period)}
                      onEvaluate={setEvaluationConsultant}
                      onSendReport={setReportConsultant}
                    />
                  </TabsContent>
                )}

                {isFullAccessManager && (
                  <TabsContent value="guide" className="mt-0">
                    <BonusGuideTab />
                  </TabsContent>
                )}
              </Tabs>
            ) : (
              <div className="space-y-3">{renderOwnContent()}</div>
            )}
          </div>
        </div>
      </div>

      <BonusEvaluationModal
        open={Boolean(evaluationConsultant)}
        consultant={evaluationConsultant}
        session={session}
        onSaved={() => setRefreshKey((current) => current + 1)}
        onOpenChange={(open) => {
          if (!open) setEvaluationConsultant(null);
        }}
      />

      <BonusMonthlyReportModal
        open={Boolean(reportConsultant)}
        consultant={reportConsultant}
        session={session}
        hideMonetary={hideMonetary}
        onSent={() => setRefreshKey((current) => current + 1)}
        onOpenChange={(open) => {
          if (!open) setReportConsultant(null);
        }}
      />

      <Dialog
        open={bonusNoticeOpen && Boolean(bonusReminder)}
        onOpenChange={(open) => {
          if (open) setBonusNoticeOpen(true);
          else dismissBonusNotice();
        }}
      >
        <DialogContent className="max-w-[26rem] overflow-hidden rounded-3xl border-blue-400/20 bg-[radial-gradient(circle_at_top,hsl(217_91%_60%/0.14),transparent_42%),linear-gradient(145deg,hsl(224_45%_9%/0.98),hsl(237_40%_12%/0.98),hsl(222_47%_8%/0.98))] p-0 text-center shadow-2xl shadow-black/55">
          <div className="relative px-6 pb-5 pt-6">
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-blue-300/45 to-transparent" />
            <DialogHeader className="items-center space-y-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-300/20 bg-blue-400/10 shadow-[0_0_24px_hsl(217_91%_60%/0.14)]">
                <FileText className="h-6 w-6 text-blue-200" />
              </div>
              <DialogTitle className="text-base font-bold text-foreground sm:text-lg">
                {bonusReminder?.title}
              </DialogTitle>
              <DialogDescription className="max-w-sm text-center text-sm leading-relaxed text-blue-100/68">
                {bonusReminder?.message}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="border-t border-white/[0.06] bg-white/[0.025] px-6 py-4">
            <Button size="sm" className="h-10 w-full rounded-xl px-5 font-semibold sm:w-auto" onClick={dismissBonusNotice}>
              Entendi
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );

  function renderOwnContent() {
    if (!myConsultant) {
      return (
        <div className="rounded-2xl border border-border/15 bg-card/35 p-10 text-center space-y-2.5">
          <p className="text-sm font-semibold text-foreground/70">
            {waitingFirstSync
              ? "Os dados ainda estão sendo carregados"
              : noVisibleConsultantsForPermission
              ? "Nenhum dado visível para este perfil"
              : "Seus dados ainda não estão disponíveis"}
          </p>
          <p className="text-xs text-muted-foreground/50 max-w-md mx-auto leading-relaxed">
            {waitingFirstSync
              ? "A primeira carga de tarefas e horas acontece automaticamente. Assim que estiver pronta, seus dados aparecerão aqui."
              : "Quando houver tarefas e horas vinculadas ao seu usuário no período selecionado, este painel será preenchido automaticamente."}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {pendingEvaluationNotification && (
          <div className="rounded-2xl border border-primary/15 bg-primary/[0.06] p-4 sm:p-5">
            <p className="text-sm font-bold text-foreground">Você recebeu uma nova avaliação.</p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Período {pendingEvaluationNotification.period_key}. Abra para revisar as notas do coordenador.
            </p>
            <button
              type="button"
              onClick={async () => {
                setExpandedConsultant(myConsultant.name);
                await supabase
                  .from("bonus_evaluation_notifications")
                  .update({ opened_at: new Date().toISOString(), read_at: new Date().toISOString() })
                  .eq("id", pendingEvaluationNotification.id);
                setRefreshKey((current) => current + 1);
              }}
              className="mt-3 rounded-xl border border-primary/25 bg-primary/12 px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/18"
            >
              Ver avaliação
            </button>
          </div>
        )}
        <BonusUserDetail
          consultant={myConsultant}
          expanded={expandedConsultant === myConsultant.name}
          onToggle={() => setExpandedConsultant(expandedConsultant === myConsultant.name ? null : myConsultant.name)}
          hideMonetary={true}
          periodLabel={periodLabel(period)}
          allTasks={allTasks}
        />
      </div>
    );
  }

  function renderRankingContent() {
    return (
      <>
        <CollapsibleSection
          title="Sinais rápidos"
          icon={TrendingUp}
          summary={
            rankingConsultants.length > 0
              ? `${trendingUp.length > 0 ? `${trendingUp.length} em destaque` : "Nenhum destaque"} · ${needsAttention.length > 0 ? `${needsAttention.length} precisam de atenção` : "Todos acima de 60%"}`
              : "Aguardando dados de consultores"
          }
        >
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
            <SectionCard title="Quem está mandando bem" icon={TrendingUp} compact badge={trendingUp.length > 0 ? <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 rounded-md px-1.5 py-0.5">{trendingUp.length}</span> : undefined}>
              {trendingUp.length > 0 ? (
                <div className="space-y-2">
                  {trendingUp.map((consultant) => (
                    <div key={consultant.name}>
                      <InsightRow name={consultant.name} score={consultant.score} payout={consultant.payout} icon={TrendingUp} color="emerald" hideMonetary={hideMonetary} />
                    </div>
                  ))}
                </div>
              ) : rankingConsultants.length > 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-amber-500/10 bg-amber-500/[0.04] px-4 py-5 text-center">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
                    <TrendingUp className="h-4 w-4 text-amber-400" />
                  </div>
                  <p className="text-xs font-semibold text-amber-400">Ninguém no destaque ainda</p>
                  <p className="text-[11px] text-muted-foreground/55 leading-relaxed">
                    {(() => {
                      const withScore = rankingConsultants.filter(c => c.scoreSource !== "none");
                      if (withScore.length === 0) {
                        return "Nenhum consultor atingiu ≥75% com entregas em dia.";
                      }
                      const top = withScore.reduce((best, c) => (c.score > best.score ? c : best), withScore[0]);
                      // Para entrar no destaque é preciso score ≥75% E entregas no prazo ≥60%.
                      // Quando o maior score já passa de 75%, o que barrou foi o prazo —
                      // deixamos isso explícito em vez de só repetir a regra do score.
                      if (top.score >= 75 && top.onTimeRate != null && top.onTimeRate < 60) {
                        return `Score mais alto: ${top.score}%, mas as entregas no prazo (${Math.round(top.onTimeRate)}%) estão abaixo dos 60% exigidos para o destaque.`;
                      }
                      return `Score mais alto: ${top.score}%. Para entrar aqui precisa de ≥75% com ao menos 60% de entregas no prazo.`;
                    })()}
                  </p>
                </div>
              ) : (
                <EmptyInsight text="Sem dados neste período." />
              )}
            </SectionCard>

            <SectionCard title="Quem precisa de atenção" icon={AlertCircle} compact badge={needsAttention.length > 0 ? <span className="text-[10px] font-bold text-red-400 bg-red-500/10 rounded-md px-1.5 py-0.5">{needsAttention.length}</span> : undefined}>
              {needsAttention.length > 0 ? (
                <div className="space-y-2">
                  {needsAttention.map((consultant) => (
                    <div key={consultant.name}>
                      <InsightRow name={consultant.name} score={consultant.score} payout={consultant.payout} icon={TrendingDown} color="red" hideMonetary={hideMonetary} />
                    </div>
                  ))}
                </div>
              ) : rankingConsultants.length > 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-emerald-500/10 bg-emerald-500/[0.04] px-4 py-5 text-center">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                  </div>
                  <p className="text-xs font-semibold text-emerald-400">Equipe saudável</p>
                  <p className="text-[11px] text-muted-foreground/55 leading-relaxed">
                    Todos os {rankingConsultants.filter(c => c.scoreSource !== "none").length} consultores estão acima de 60%.
                    {(() => {
                      const withScore = rankingConsultants.filter(c => c.scoreSource !== "none");
                      const min = withScore.length > 0 ? Math.min(...withScore.map(c => c.score)) : null;
                      return min !== null ? ` Score mais baixo: ${min}%.` : "";
                    })()}
                  </p>
                </div>
              ) : (
                <EmptyInsight text="Sem dados neste período." />
              )}
            </SectionCard>

            <SectionCard title="Distribuição da equipe" icon={PieChart} compact badge={rankingConsultants.length > 0 ? <span className="text-[10px] font-bold text-muted-foreground bg-white/[0.05] rounded-md px-1.5 py-0.5">{rankingConsultants.length} pessoas</span> : undefined}>
              {rankingConsultants.length > 0 ? (
                <ScoreDistribution consultants={rankingConsultants} />
              ) : (
                <EmptyInsight text="Sem dados de scores calculados." />
              )}
            </SectionCard>
          </div>
        </CollapsibleSection>

        {canSeeAllEvaluations && (
          <CollapsibleSection
            title="Score do Consultor"
            icon={Target}
            summary={
              topPerformer
                ? `Melhor score: ${topPerformer.score}% (${topPerformer.name})`
                : "Veja como o score é composto e o teto por nível"
            }
          >
            <BonusScoreComposition consultants={rankingConsultants} />
          </CollapsibleSection>
        )}

        <CollapsibleSection
          title="Evolução ao longo do tempo"
          icon={TrendingUp}
          summary={
            bonus.persistence.consultantSnapshots.length > 0
              ? `${new Set(bonus.persistence.consultantSnapshots.filter((snapshot) => snapshot.period_type === "month").map((snapshot) => snapshot.period_key)).size} meses com dados registrados`
              : "O histórico aparecerá quando houver períodos gravados"
          }
        >
          <BonusTrendsSection
            hideMonetary={hideMonetary}
            consultants={visibleConsultants}
            consultantSnapshots={bonus.persistence.consultantSnapshots.filter((snapshot) =>
              !snapshot.user_id ||
              visibleConsultants.some((consultant) => consultant.userId === String(snapshot.user_id))
            )}
          />
        </CollapsibleSection>

        <div id="bonus-ranking">
          {(() => {
            const total = rankingConsultants.length;
            const evaluated = rankingConsultants.filter((consultant) => consultant.coordinatorScore != null).length;
            const ratio = total > 0 ? evaluated / total : 0;
            const counterColor =
              total === 0
                ? "text-muted-foreground bg-card/30 border-border/10"
                : evaluated === total
                ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20"
                : ratio >= 0.5
                ? "text-amber-300 bg-amber-500/10 border-amber-500/20"
                : "text-red-300 bg-red-500/10 border-red-500/20";
            const counterBadge = total > 0
              ? (
                <span className={`text-[10px] font-bold rounded-md px-1.5 py-0.5 border ${counterColor}`}>
                  {`${evaluated} de ${total} consultores avaliados pelo coordenador`}
                </span>
              )
              : undefined;
            return (
          <CollapsibleSection
            title="Ranking de Consultores"
            icon={Crown}
            summary={
              topPerformer
                ? `${rankingConsultants.length} consultores · Líder: ${topPerformer.name} com ${topPerformer.score}%`
                : "Nenhum consultor encontrado neste período"
            }
            badge={counterBadge ?? (rankingConsultants.length > 0 ? <span className="text-[10px] font-bold text-primary bg-primary/10 rounded-md px-1.5 py-0.5">{rankingConsultants.length}</span> : undefined)}
          >
            <div className="space-y-4">
              <div className="grid min-w-0 gap-2.5 lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-center">
                <div className="relative w-full">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar consultor..."
                    className="h-10 min-w-0 rounded-xl border-border/15 bg-card/40 pl-10 text-sm"
                  />
                </div>

                <Select value={evaluationFilter} onValueChange={(v) => setEvaluationFilter(v as "all" | "evaluated" | "pending")}>
                  <SelectTrigger className="h-10 min-w-0 rounded-xl border-border/15 bg-card/40 text-sm text-foreground hover:bg-card/55 focus:ring-0 focus:ring-offset-0 focus:border-primary/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border border-border/15 bg-[hsl(222_47%_11%)] shadow-2xl shadow-black/40 z-50">
                    <SelectItem value="all" className="text-sm text-muted-foreground/70 hover:text-foreground hover:bg-white/[0.05] rounded-lg cursor-pointer focus:bg-white/[0.05] focus:text-foreground">Todas as avaliações</SelectItem>
                    <SelectItem value="evaluated" className="text-sm text-muted-foreground/70 hover:text-foreground hover:bg-white/[0.05] rounded-lg cursor-pointer focus:bg-white/[0.05] focus:text-foreground">Somente avaliados</SelectItem>
                    <SelectItem value="pending" className="text-sm text-muted-foreground/70 hover:text-foreground hover:bg-white/[0.05] rounded-lg cursor-pointer focus:bg-white/[0.05] focus:text-foreground">Somente pendentes</SelectItem>
                  </SelectContent>
                </Select>

                {hasActiveRankingFilters ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setEvaluationFilter("all");
                    }}
                    className="h-10 rounded-xl border border-border/15 bg-card/30 px-4 text-sm font-semibold text-foreground/80 transition-colors hover:bg-card/50 lg:w-auto"
                  >
                    Limpar filtros
                  </button>
                ) : (
                  <div />
                )}
              </div>

              <div className="space-y-3">
                {filteredConsultants.map((consultant, index) => {
                  const canManageConsultant = consultant.userId != null && (session?.coordinatorOf ?? []).includes(consultant.userId);

                  return (
                    <div key={consultant.userId ?? consultant.name}>
                      <RankingCard
                        consultant={consultant}
                        rank={index + 1}
                        expanded={expandedConsultant === consultant.name}
                        onToggle={() => setExpandedConsultant(expandedConsultant === consultant.name ? null : consultant.name)}
                        hideMonetary={hideMonetary}
                        periodLabel={periodLabel(period)}
                        canEvaluate={canSeeAllEvaluations || canManageConsultant}
                        canSendReport={canSeeAllEvaluations || canManageConsultant}
                        onEvaluate={setEvaluationConsultant}
                        onSendReport={setReportConsultant}
                      />
                    </div>
                  );
                })}

                {filteredConsultants.length === 0 && (
                  <div className="rounded-2xl border border-border/15 bg-card/35 p-10 text-center space-y-2.5">
                    <p className="text-sm font-semibold text-foreground/70">
                      {waitingFirstSync
                        ? "Os dados ainda estão sendo carregados"
                        : noDataForPeriod
                        ? "Nenhum resultado neste período"
                        : noOperationalConsultantsForPeriod
                        ? "Ainda não há base operacional suficiente"
                        : hasActiveRankingFilters
                        ? "Nenhum consultor encontrado com os filtros atuais"
                        : "Nenhum consultor disponível"}
                    </p>
                    <p className="text-xs text-muted-foreground/50 max-w-md mx-auto leading-relaxed">
                      {waitingFirstSync
                        ? "A primeira carga de tarefas e horas acontece automaticamente. Assim que estiver pronta, os consultores aparecerão aqui."
                        : noDataForPeriod
                        ? "Tente selecionar outro período acima."
                        : noOperationalConsultantsForPeriod
                        ? "Já existem projetos e cadastros, mas ainda faltam tarefas e horas suficientes para compor o ranking deste período."
                        : hasActiveRankingFilters
                        ? "Ajuste a busca ou limpe os filtros para visualizar novamente a lista completa."
                        : "Quando houver consultores elegíveis com tarefas registradas no período selecionado, o ranking será exibido aqui."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CollapsibleSection>
            );
          })()}
        </div>
      </>
    );
  }
}
