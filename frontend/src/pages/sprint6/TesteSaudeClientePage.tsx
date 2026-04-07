// ── Sprint 6.0 — Dashboard Saúde do Cliente (redesigned) ───────────
import { useMemo, useState } from "react";
import {
  HeartPulse,
  TrendingUp,
  TrendingDown,
  Users,
  Star,
  ShieldAlert,
  Target,
  Activity,
} from "lucide-react";
import { motion } from "framer-motion";
import { usePageSEO } from "@/hooks/usePageSEO";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useClientHealthData } from "@/modules/sprint6/hooks/useClientHealthData";
import { ClientHealthTrendChart } from "@/modules/sprint6/components/ClientHealthTrendChart";
import { ClientHealthBenchmarkCard } from "@/modules/sprint6/components/ClientHealthBenchmarkCard";
import { ClientHealthScoreTable } from "@/modules/sprint6/components/ClientHealthScoreTable";
import {
  Sprint6Filters,
  DEFAULT_SPRINT6_FILTERS,
  type Sprint6FilterState,
} from "@/modules/sprint6/components/Sprint6Filters";

import { Badge } from "@/components/ui/badge";
import PageSkeleton from "@/components/ui/PageSkeleton";
import DataErrorCard from "@/components/ui/DataErrorCard";
import type { ClientHealthSummary } from "@/modules/sprint6/types";

/* ── Animations ──────────────────────────────────────────────────── */
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, delay, ease: "easeOut" as const },
});

/* ── KPI Card ────────────────────────────────────────────────────── */
function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  delay = 0,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  accent: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: "easeOut" as const }}
      className="group relative overflow-hidden rounded-2xl border border-white/[0.06] p-4 sm:p-5 transition-all duration-500 hover:-translate-y-0.5 hover:border-white/[0.12] hover:shadow-xl"
      style={{
        background:
          "linear-gradient(145deg, hsl(270 50% 14% / 0.7), hsl(234 45% 10% / 0.5))",
      }}
    >
      <div
        className="absolute top-3 right-3 h-2 w-2 rounded-full opacity-50 group-hover:opacity-100 transition-opacity"
        style={{ background: accent }}
      />
      <div className="flex items-center justify-center mb-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
          style={{ background: `${accent.replace(")", " / 0.15)")}` }}
        >
          <Icon className="h-4 w-4" style={{ color: accent }} />
        </div>
      </div>
      <p className="text-[11px] font-semibold text-white/40 text-center mb-1 uppercase tracking-wide">
        {label}
      </p>
      <p className="text-2xl font-bold text-white/90 text-center">{value}</p>
      <p className="text-[10px] text-white/25 mt-0.5 text-center">{sub}</p>
    </motion.div>
  );
}

/* ── Section Card ────────────────────────────────────────────────── */
function SectionCard({
  title,
  icon: Icon,
  children,
  badge,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/12 bg-card/40 backdrop-blur-sm overflow-hidden h-full">
      <div className="flex items-center justify-between gap-2 border-b border-border/8 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-3.5 w-3.5 text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        {badge}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

/* ── Compact Empty State ─────────────────────────────────────────── */
function CompactEmptyState() {
  return (
    <motion.div {...fadeUp(0.1)}>
      <div className="rounded-2xl border border-rose-500/15 bg-rose-500/[0.04] p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-400/10">
            <HeartPulse className="h-4 w-4 text-rose-300" />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">
              Base de saúde indisponível
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
              Popule{" "}
              <strong className="text-foreground">client_kpis</strong> com
              indicadores mensais e{" "}
              <strong className="text-foreground">client_benchmarks</strong>{" "}
              para referência setorial.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge
                variant="outline"
                className="text-[9px] bg-white/[0.03] text-white/40 border-white/10"
              >
                1. Cadastrar KPIs mensais
              </Badge>
              <Badge
                variant="outline"
                className="text-[9px] bg-white/[0.03] text-white/40 border-white/10"
              >
                2. Definir benchmarks
              </Badge>
              <Badge
                variant="outline"
                className="text-[9px] bg-white/[0.03] text-white/40 border-white/10"
              >
                3. Padronizar identificadores
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Main Component ──────────────────────────────────────────────── */
export default function TesteSaudeClientePage() {
  usePageSEO("Saude do Cliente");
  const { session, loadingSession } = useAuth();
  const health = useClientHealthData({ accessToken: session?.accessToken });
  const [filters, setFilters] = useState<Sprint6FilterState>(
    DEFAULT_SPRINT6_FILTERS
  );

  // Filter summary by selected client
  const selectedClientName = health.clientOptions.find(
    (c) => c.id === filters.clienteId
  )?.name ?? null;

  const filteredSummary = useMemo<ClientHealthSummary | null>(() => {
    if (!health.summary) return null;
    if (!selectedClientName) return health.summary;

    const filteredClients = health.summary.clients.filter(
      (c) => c.clienteName === selectedClientName
    );
    const clientRows = health.kpiRows.filter(
      (r) => r.clienteName === selectedClientName
    );
    const trends = clientRows
      .map((r) => ({
        month: r.month,
        ebitda: r.ebitda,
        churn: r.churn,
        nps: r.nps,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return { ...health.summary, clients: filteredClients, trends };
  }, [health.summary, health.kpiRows, selectedClientName]);

  const filteredAtRisk = useMemo(() => {
    if (!filteredSummary) return [];
    return filteredSummary.clients
      .filter((c) => c.isAtRisk)
      .sort((a, b) => (a.healthScore ?? 100) - (b.healthScore ?? 100));
  }, [filteredSummary]);

  // KPI helpers
  const clientCount = filteredSummary?.clients.length ?? 0;
  const avgEbitda =
    clientCount > 0
      ? filteredSummary!.clients.reduce((s, c) => s + (c.ebitda ?? 0), 0) /
        clientCount
      : null;
  const avgChurn =
    clientCount > 0
      ? filteredSummary!.clients.reduce((s, c) => s + (c.churn ?? 0), 0) /
        clientCount
      : null;
  const avgNps =
    clientCount > 0
      ? filteredSummary!.clients.reduce((s, c) => s + (c.nps ?? 0), 0) /
        clientCount
      : null;

  if (loadingSession) return <PageSkeleton variant="analiticas" />;

  if (!session?.accessToken) {
    return (
      <div className="page-gradient w-full">
        <div className="mx-auto w-full max-w-[1900px] p-4 sm:p-5 md:p-8">
          <DataErrorCard
            title="Sessão não inicializada"
            message="Faça login novamente se o problema persistir."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page-gradient w-full">
      <div className="mx-auto w-full max-w-[1900px] space-y-5 p-4 sm:p-5 md:p-8">
        {/* ── Hero Header ──────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative overflow-hidden rounded-2xl border border-white/[0.07] p-5 sm:p-6 lg:p-7"
          style={{ background: "linear-gradient(145deg, hsl(222 40% 9% / 0.92), hsl(228 36% 8% / 0.72))" }}
        >
          <motion.div
            className="pointer-events-none absolute inset-y-0 right-0 w-[40%]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, delay: 0.3 }}
            style={{ background: "radial-gradient(circle at center, hsl(0 72% 51% / 0.10), transparent 65%)" }}
          />
          <div className="relative flex items-center gap-4 min-w-0">
            <motion.div
              className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-400/25 bg-rose-500/10 shrink-0"
              animate={{ boxShadow: ["0 0 10px hsl(0 72% 51% / 0.08)", "0 0 24px hsl(0 72% 51% / 0.25)", "0 0 10px hsl(0 72% 51% / 0.08)"], scale: [1, 1.06, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <motion.div animate={{ scale: [1, 1.25, 1, 1.2, 1] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}>
                <HeartPulse className="h-5 w-5 text-rose-400" />
              </motion.div>
            </motion.div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-foreground tracking-tight sm:text-2xl">Saúde do Cliente</h1>
              <p className="text-xs text-white/40 mt-0.5 leading-relaxed">Score, risco de churn e tendência da carteira</p>
            </div>
          </div>
        </motion.div>

        {/* ── Filters ─────────────────────────────────────────── */}
        {!health.loading && !health.isEmpty && (
          <motion.div {...fadeUp(0.05)}>
            <Sprint6Filters
              filters={filters}
              onChange={setFilters}
              options={{ clientes: health.clientOptions }}
            />
          </motion.div>
        )}

        {/* ── Alert: at-risk ─────────────────────────────────── */}
        {!health.loading && filteredAtRisk.length > 0 && (
          <motion.div {...fadeUp(0.08)}>
            <div className="rounded-xl border border-rose-500/15 bg-rose-500/[0.04] px-4 py-2.5 text-xs text-rose-300/80 flex items-center gap-2">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              <strong>{filteredAtRisk.length}</strong> cliente
              {filteredAtRisk.length > 1 ? "s" : ""} em risco (score &lt; 40)
            </div>
          </motion.div>
        )}

        {/* ── Loading ─────────────────────────────────────────── */}
        {health.loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/[0.06] p-5 animate-pulse"
                style={{
                  background:
                    "linear-gradient(145deg, hsl(270 50% 14% / 0.7), hsl(234 45% 10% / 0.5))",
                }}
              >
                <div className="flex justify-center mb-3">
                  <div className="h-9 w-9 rounded-xl bg-white/[0.06]" />
                </div>
                <div className="h-3 w-16 mx-auto rounded bg-white/[0.06] mb-2" />
                <div className="h-6 w-12 mx-auto rounded bg-white/[0.06]" />
              </div>
            ))}
          </div>
        )}

        {/* ── Error ───────────────────────────────────────────── */}
        {health.error && !health.loading && (
          <motion.div {...fadeUp(0.1)}>
            <div className="rounded-xl border border-destructive/20 bg-destructive/[0.06] px-4 py-2.5 text-xs text-destructive flex items-center gap-2">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              {health.error}
            </div>
          </motion.div>
        )}

        {/* ── Empty state ─────────────────────────────────────── */}
        {!health.loading && !health.error && health.isEmpty && (
          <CompactEmptyState />
        )}

        {/* ── Dashboard Content ───────────────────────────────── */}
        {!health.loading && !health.error && !health.isEmpty && filteredSummary && (
          <>
            {/* KPI Strip */}
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
              <KpiCard
                label="EBITDA Médio"
                value={
                  avgEbitda != null
                    ? `R$ ${Math.round(avgEbitda).toLocaleString("pt-BR")}`
                    : "Não encontrado"
                }
                sub="Margem operacional média"
                icon={TrendingUp}
                accent="hsl(262 83% 58%)"
                delay={0.1}
              />
              <KpiCard
                label="Churn Rate"
                value={avgChurn != null ? `${avgChurn.toFixed(1)}%` : "Não encontrado"}
                sub="Taxa de cancelamento"
                icon={TrendingDown}
                accent={
                  avgChurn != null && avgChurn > 5
                    ? "hsl(0 84% 60%)"
                    : "hsl(200 80% 55%)"
                }
                delay={0.13}
              />
              <KpiCard
                label="NPS Médio"
                value={avgNps != null ? String(Math.round(avgNps)) : "Não encontrado"}
                sub="Net Promoter Score"
                icon={Star}
                accent={
                  avgNps != null && avgNps >= 50
                    ? "hsl(160 84% 39%)"
                    : avgNps != null && avgNps >= 0
                    ? "hsl(45 93% 58%)"
                    : "hsl(0 84% 60%)"
                }
                delay={0.16}
              />
              <KpiCard
                label="Clientes"
                value={String(clientCount)}
                sub="Monitorados no período"
                icon={Users}
                accent="hsl(160 84% 39%)"
                delay={0.19}
              />
            </div>

            {/* Main Grid: Score Table + Benchmark */}
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-5">
              <motion.div {...fadeUp(0.22)} className="lg:col-span-3">
                <SectionCard
                  title="Health Score por Cliente"
                  icon={HeartPulse}
                  badge={
                    filteredAtRisk.length > 0 ? (
                      <Badge
                        variant="outline"
                        className="text-[9px] bg-rose-500/10 text-rose-400 border-rose-500/20"
                      >
                        {filteredAtRisk.length} em risco
                      </Badge>
                    ) : undefined
                  }
                >
                  <ClientHealthScoreTable clients={filteredSummary.clients} />
                </SectionCard>
              </motion.div>
              <motion.div {...fadeUp(0.25)} className="lg:col-span-2">
                <SectionCard title="Benchmark Setorial" icon={Target}>
                  <ClientHealthBenchmarkCard summary={filteredSummary} />
                </SectionCard>
              </motion.div>
            </div>

            {/* Trend Chart */}
            <motion.div {...fadeUp(0.28)}>
              <SectionCard
                title={
                  selectedClientName
                    ? `Tendência — ${selectedClientName}`
                    : "Tendência da Carteira"
                }
                icon={Activity}
              >
                {filteredSummary.trends.length > 0 ? (
                  <ClientHealthTrendChart data={filteredSummary.trends} />
                ) : (
                  <div className="rounded-xl border border-dashed border-border/20 bg-black/10 px-4 py-6 text-xs text-muted-foreground text-center">
                    Registre pelo menos dois períodos em{" "}
                    <strong className="text-foreground">client_kpis</strong>{" "}
                    para visualizar tendências.
                  </div>
                )}
              </SectionCard>
            </motion.div>

            {/* Partial data footnote */}
            {health.missingDependencies.length > 0 && (
              <motion.div {...fadeUp(0.3)}>
                <div className="rounded-xl border border-amber-500/12 bg-amber-500/[0.03] px-4 py-2 text-[10px] text-amber-200/50 flex items-center gap-2">
                  <ShieldAlert className="h-3 w-3 shrink-0" />
                  Base parcial — revise client_kpis e client_benchmarks para
                  leitura completa
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
