import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, BarChart3, Wallet, Calendar } from "lucide-react";
import type { BonusConsultantCard } from "@/modules/sprint6/hooks/useBonusRealData";
import type { BonusScoreSnapshotRow } from "@/modules/sprint6/hooks/useBonusPersistenceData";
import { money } from "./BonusHelpers";
import { fadeUp } from "./BonusAnimations";
import { SectionCard, EmptyInsight } from "./BonusSharedCards";

/* ── Types ─────────────────────────────────────────────────────────── */
interface TrendPoint {
  period: string;
  label: string;
  avgScore: number;
  totalPayout: number;
  consultantCount: number;
}

interface BonusTrendsSectionProps {
  consultants: BonusConsultantCard[];
  consultantSnapshots: BonusScoreSnapshotRow[];
}

/* ── Helpers ───────────────────────────────────────────────────────── */
function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatPeriodLabel(key: string) {
  const parts = key.split("-");
  if (parts.length === 2) {
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const monthIdx = parseInt(parts[1], 10) - 1;
    return `${monthNames[monthIdx] ?? parts[1]}/${parts[0].slice(2)}`;
  }
  return key;
}

/* ── Trend Indicator ──────────────────────────────────────────────── */
function TrendIndicator({ current, previous, suffix = "" }: { current: number; previous: number | null; suffix?: string }) {
  if (previous == null) return <span className="text-[11px] text-muted-foreground/40 italic">primeiro registro</span>;
  const diff = current - previous;
  const pct = previous > 0 ? Math.round((diff / previous) * 100) : 0;
  const isUp = diff > 0;
  const isFlat = Math.abs(pct) < 2;

  if (isFlat) {
    return (
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
        <Minus className="h-3 w-3" /> Estável
      </span>
    );
  }

  return (
    <span className={`flex items-center gap-1 text-[11px] font-medium ${isUp ? "text-emerald-400" : "text-red-400"}`}>
      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isUp ? "+" : ""}{pct}%{suffix}
    </span>
  );
}

/* ── Custom Tooltip ────────────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/15 bg-card/95 px-3 py-2 shadow-lg backdrop-blur-sm">
      <p className="text-xs font-semibold text-foreground mb-1">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} className="text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">{entry.name}: </span>
          {entry.dataKey === "totalPayout" ? money(entry.value) : `${Math.round(entry.value)}%`}
        </p>
      ))}
    </div>
  );
}

/* ── Single Period Card ────────────────────────────────────────────── */
function SinglePeriodCard({ label, value, periodLabel, color }: { label: string; value: string; periodLabel: string; color: string }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
          <p className="text-[11px] text-muted-foreground/60">{label}</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] px-2.5 py-1">
          <Calendar className="h-3 w-3 text-muted-foreground/40" />
          <span className="text-[10px] font-medium text-muted-foreground/50">{periodLabel}</span>
        </div>
      </div>
      <div className="rounded-xl border border-border/8 bg-white/[0.015] p-4 text-center">
        <p className="text-xs text-muted-foreground/50 leading-relaxed">
          Este é o primeiro período com dados registrados. A partir do próximo ciclo, será possível acompanhar a evolução ao longo do tempo.
        </p>
      </div>
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────────── */
export function BonusTrendsSection({ consultants, consultantSnapshots }: BonusTrendsSectionProps) {
  const trendData = useMemo(() => {
    const periodMap = new Map<string, { scores: number[]; payouts: number[]; count: number }>();

    consultantSnapshots.forEach((snap) => {
      if (snap.period_type !== "month") return;
      const existing = periodMap.get(snap.period_key) ?? { scores: [], payouts: [], count: 0 };
      existing.scores.push(Number(snap.score));
      existing.payouts.push(Number(snap.payout_amount));
      existing.count += 1;
      periodMap.set(snap.period_key, existing);
    });

    if (consultants.length > 0) {
      const currentKey = currentMonthKey();
      const existing = periodMap.get(currentKey) ?? { scores: [], payouts: [], count: 0 };
      if (existing.count === 0) {
        consultants.forEach((c) => {
          existing.scores.push(c.score);
          existing.payouts.push(c.payout);
          existing.count += 1;
        });
        periodMap.set(currentKey, existing);
      }
    }

    const points: TrendPoint[] = Array.from(periodMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, data]) => ({
        period: key,
        label: formatPeriodLabel(key),
        avgScore: data.scores.length > 0 ? Math.round(data.scores.reduce((s, v) => s + v, 0) / data.scores.length) : 0,
        totalPayout: Math.round(data.payouts.reduce((s, v) => s + v, 0)),
        consultantCount: data.count,
      }));

    return points;
  }, [consultants, consultantSnapshots]);

  const hasHistory = trendData.length >= 2;
  const currentPoint = trendData[trendData.length - 1] ?? null;
  const previousPoint = trendData.length >= 2 ? trendData[trendData.length - 2] : null;

  return (
    <motion.div {...fadeUp} transition={{ duration: 0.35 }} className="grid gap-4 xl:grid-cols-2">
      {/* Score Evolution */}
      <SectionCard title="Evolução do Score" icon={BarChart3}>
        {hasHistory ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-foreground">{currentPoint?.avgScore ?? 0}%</p>
                <p className="text-[11px] text-muted-foreground/60">Score médio atual</p>
              </div>
              <div className="text-right">
                <TrendIndicator current={currentPoint?.avgScore ?? 0} previous={previousPoint?.avgScore ?? null} />
                {previousPoint && (
                  <p className="text-[10px] text-muted-foreground/40 mt-0.5">vs {previousPoint.label}</p>
                )}
              </div>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.1)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground) / 0.5)" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground) / 0.5)" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="avgScore"
                    name="Score médio"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#scoreGradient)"
                    dot={{ r: 3, fill: "hsl(var(--primary))", strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: "hsl(var(--primary))", strokeWidth: 2, stroke: "hsl(var(--background))" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : trendData.length === 1 ? (
          <SinglePeriodCard
            label="Score médio atual"
            value={`${currentPoint?.avgScore ?? 0}%`}
            periodLabel={currentPoint?.label ?? ""}
            color="text-foreground"
          />
        ) : (
          <EmptyInsight text="Os scores são registrados automaticamente a cada ciclo. Quando o primeiro período for concluído, a evolução vai aparecer aqui." />
        )}
      </SectionCard>

      {/* Payout Evolution */}
      <SectionCard title="Evolução do Payout" icon={Wallet}>
        {hasHistory ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-primary">{money(currentPoint?.totalPayout ?? 0)}</p>
                <p className="text-[11px] text-muted-foreground/60">Payout total atual</p>
              </div>
              <div className="text-right">
                <TrendIndicator current={currentPoint?.totalPayout ?? 0} previous={previousPoint?.totalPayout ?? null} />
                {previousPoint && (
                  <p className="text-[10px] text-muted-foreground/40 mt-0.5">vs {previousPoint.label}: {money(previousPoint.totalPayout)}</p>
                )}
              </div>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="payoutGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.1)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground) / 0.5)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground) / 0.5)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="totalPayout"
                    name="Payout total"
                    stroke="hsl(142, 71%, 45%)"
                    strokeWidth={2}
                    fill="url(#payoutGradient)"
                    dot={{ r: 3, fill: "hsl(142, 71%, 45%)", strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: "hsl(142, 71%, 45%)", strokeWidth: 2, stroke: "hsl(var(--background))" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : trendData.length === 1 ? (
          <SinglePeriodCard
            label="Payout total atual"
            value={money(currentPoint?.totalPayout ?? 0)}
            periodLabel={currentPoint?.label ?? ""}
            color="text-primary"
          />
        ) : (
          <EmptyInsight text="Os valores de payout são gravados automaticamente. A partir do segundo período registrado, o gráfico de evolução vai aparecer aqui." />
        )}
      </SectionCard>
    </motion.div>
  );
}
