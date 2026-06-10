import { useMemo, useState } from "react";
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

interface ConsultantTrendChange {
  userId: string;
  name: string;
  currentLabel: string;
  previousLabel: string;
  currentScore: number;
  previousScore: number;
  delta: number;
}

interface BonusTrendsSectionProps {
  consultants: BonusConsultantCard[];
  consultantSnapshots: BonusScoreSnapshotRow[];
  /** When true, the payout (R$) evolution section is hidden entirely.
      Only the payment manager may see monetary values. */
  hideMonetary?: boolean;
}

/* ── Helpers ───────────────────────────────────────────────────────── */
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
  if (previous == null) return <span className="text-[11px] text-white/35 italic">primeiro registro</span>;
  const diff = current - previous;
  const pct = previous > 0 ? Math.round((diff / previous) * 100) : 0;
  const isUp = diff > 0;
  const isFlat = Math.abs(pct) < 2;

  if (isFlat) {
    return (
      <span className="flex items-center gap-1 text-[11px] text-white/45">
        <Minus className="h-3 w-3" /> Estável
      </span>
    );
  }

  return (
    <span className={`flex items-center gap-1 text-[11px] font-semibold ${isUp ? "text-emerald-400" : "text-red-400"}`}>
      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isUp ? "+" : ""}{pct}%{suffix}
    </span>
  );
}

/* ── Custom Tooltip ────────────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/[0.1] bg-[hsl(224_40%_10%/0.98)] px-3.5 py-2.5 shadow-xl backdrop-blur-sm">
      <p className="text-[11px] font-semibold text-white/70 mb-1.5">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} className="text-[12px] font-bold text-white">
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
          <p className="text-[11px] text-white/40">{label}</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] px-2.5 py-1">
          <Calendar className="h-3 w-3 text-white/30" />
          <span className="text-[10px] font-medium text-white/40">{periodLabel}</span>
        </div>
      </div>
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
        <p className="text-xs text-white/40 leading-relaxed">
          Este é o primeiro período com dados registrados. A partir do próximo ciclo, será possível acompanhar a evolução ao longo do tempo.
        </p>
      </div>
    </div>
  );
}

/* ── Consultant Trend List ─────────────────────────────────────────── */
function ConsultantTrendList({
  title,
  items,
  emptyText,
  positive,
}: {
  title: string;
  items: ConsultantTrendChange[];
  emptyText: string;
  positive: boolean;
}) {
  const accent = positive ? "text-emerald-400" : "text-red-400";
  const accentBorder = positive ? "border-emerald-500/15" : "border-red-500/15";
  const accentBg = positive ? "bg-emerald-500/[0.04]" : "bg-red-500/[0.04]";
  const accentDot = positive ? "bg-emerald-400" : "bg-red-400";

  return (
    <div className={`rounded-xl border ${accentBorder} ${accentBg} p-3.5`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/40">{title}</p>
        <span className={`text-[11px] font-semibold ${accent}`}>
          {items.length > 0 ? `${positive ? "+" : ""}${items[0]?.delta ?? 0} pts` : "sem variação"}
        </span>
      </div>
      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item, i) => (
            <motion.div
              key={`${item.userId}-${item.currentLabel}`}
              initial={{ opacity: 0, x: positive ? -8 : 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: i * 0.06 }}
              className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.05] bg-white/[0.025] px-3 py-2.5"
            >
              <div className="min-w-0 flex items-center gap-2">
                <span className={`shrink-0 h-1.5 w-1.5 rounded-full ${accentDot}`} />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-white/85">{item.name}</p>
                  <p className="text-[10px] text-white/35">
                    {item.previousLabel}: {item.previousScore}% → {item.currentLabel}: {item.currentScore}%
                  </p>
                </div>
              </div>
              <span className={`shrink-0 text-sm font-bold tabular-nums ${accent}`}>
                {positive ? "+" : ""}{item.delta}
              </span>
            </motion.div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-white/35 leading-relaxed">{emptyText}</p>
      )}
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────────── */
export function BonusTrendsSection({ consultants, consultantSnapshots, hideMonetary = false }: BonusTrendsSectionProps) {
  const [scoreAnimated, setScoreAnimated] = useState(false);
  const [payoutAnimated, setPayoutAnimated] = useState(false);
  // "" = visão geral (média da equipe). Caso contrário, filtra a evolução por consultor.
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  // Consultores que possuem ao menos um período registrado (para o seletor).
  const consultantOptions = useMemo(() => {
    const idsWithHistory = new Set(
      consultantSnapshots
        .filter((snap) => snap.period_type === "month" && snap.user_id != null)
        .map((snap) => String(snap.user_id)),
    );
    return consultants
      .filter((c) => c.userId && idsWithHistory.has(c.userId))
      .map((c) => ({ id: c.userId as string, name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [consultants, consultantSnapshots]);

  const selectedConsultantName = selectedUserId
    ? consultantOptions.find((c) => c.id === selectedUserId)?.name ?? null
    : null;

  const trendData = useMemo(() => {
    const periodMap = new Map<string, { scores: number[]; payouts: number[]; count: number }>();

    consultantSnapshots.forEach((snap) => {
      if (snap.period_type !== "month") return;
      // Quando um consultor esta selecionado, consideramos apenas os snapshots dele,
      // mostrando a linha de evolucao individual ao longo de todos os periodos.
      if (selectedUserId && String(snap.user_id) !== selectedUserId) return;
      const existing = periodMap.get(snap.period_key) ?? { scores: [], payouts: [], count: 0 };
      existing.scores.push(Number(snap.score));
      existing.payouts.push(Number(snap.payout_amount));
      existing.count += 1;
      periodMap.set(snap.period_key, existing);
    });

    return Array.from(periodMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, data]) => ({
        period: key,
        label: formatPeriodLabel(key),
        avgScore: data.scores.length > 0 ? Math.round(data.scores.reduce((s, v) => s + v, 0) / data.scores.length) : 0,
        totalPayout: Math.round(data.payouts.reduce((s, v) => s + v, 0)),
        consultantCount: data.count,
      }));
  }, [consultantSnapshots, selectedUserId]);

  const consultantChanges = useMemo(() => {
    const byUser = new Map<string, Array<{ period: string; score: number }>>();

    consultantSnapshots.forEach((snap) => {
      if (snap.period_type !== "month" || !snap.user_id) return;
      const userId = String(snap.user_id);
      const rows = byUser.get(userId) ?? [];
      rows.push({ period: snap.period_key, score: Number(snap.score) });
      byUser.set(userId, rows);
    });

    return consultants
      .map((consultant) => {
        if (!consultant.userId) return null;
        const rows = (byUser.get(consultant.userId) ?? [])
          .sort((a, b) => a.period.localeCompare(b.period))
          .filter((row, index, list) => index === list.findIndex((item) => item.period === row.period));

        if (rows.length < 2) return null;

        const current = rows[rows.length - 1];
        const previous = rows[rows.length - 2];
        const delta = current.score - previous.score;

        return {
          userId: consultant.userId,
          name: consultant.name,
          currentLabel: formatPeriodLabel(current.period),
          previousLabel: formatPeriodLabel(previous.period),
          currentScore: current.score,
          previousScore: previous.score,
          delta,
        } satisfies ConsultantTrendChange;
      })
      .filter((item): item is ConsultantTrendChange => item != null);
  }, [consultants, consultantSnapshots]);

  const improvingConsultants = useMemo(
    () => consultantChanges.filter((item) => item.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 3),
    [consultantChanges],
  );
  const decliningConsultants = useMemo(
    () => consultantChanges.filter((item) => item.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 3),
    [consultantChanges],
  );

  const hasHistory = trendData.length >= 2;
  const currentPoint = trendData[trendData.length - 1] ?? null;
  const previousPoint = trendData.length >= 2 ? trendData[trendData.length - 2] : null;

  const axisStyle = { fontSize: 10, fill: "rgba(255,255,255,0.3)" };

  // Dynamic Y domain: pad ±10 around actual range so the line fills the chart area
  const scoreDomain = useMemo((): [number, number] => {
    if (trendData.length === 0) return [0, 100];
    const vals = trendData.map((d) => d.avgScore);
    const lo = Math.max(0, Math.min(...vals) - 10);
    const hi = Math.min(100, Math.max(...vals) + 10);
    return [Math.floor(lo / 5) * 5, Math.ceil(hi / 5) * 5];
  }, [trendData]);

  const payoutDomain = useMemo((): [number, number] => {
    if (trendData.length === 0) return [0, 1];
    const vals = trendData.map((d) => d.totalPayout);
    const lo = Math.max(0, Math.min(...vals) * 0.85);
    const hi = Math.max(...vals) * 1.15;
    return [Math.floor(lo), Math.ceil(hi)];
  }, [trendData]);

  return (
    <motion.div {...fadeUp} transition={{ duration: 0.35 }} className="space-y-4">

      {/* ── Cabeçalho: filtro por consultor + explicação do período ── */}
      <div className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-white/80">
            {selectedConsultantName
              ? `Evolução de ${selectedConsultantName}`
              : "Evolução de toda a equipe"}
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-white/40">
            Acompanha todos os períodos (meses) com dados registrados ao longo do tempo.
            {consultantOptions.length > 0 && " Selecione um consultor para ver a linha individual dele."}
          </p>
        </div>
        {consultantOptions.length > 0 && (
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="h-9 w-full shrink-0 rounded-lg border border-white/[0.08] bg-[hsl(var(--task-surface))] px-3 text-[12px] font-medium text-white/70 outline-none transition hover:border-white/[0.15] focus:border-primary/40 sm:w-56 [color-scheme:dark]"
            aria-label="Filtrar evolução por consultor"
          >
            <option value="">Toda a equipe (média)</option>
            {consultantOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">

      {/* ── Score Evolution ── */}
      <SectionCard title={selectedConsultantName ? "Evolução do Score (consultor)" : "Evolução do Score"} icon={BarChart3}>
        {hasHistory ? (
          <div className="space-y-4">
            {/* KPI row */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-3xl font-extrabold text-white/90 tabular-nums leading-none">
                  {currentPoint?.avgScore ?? 0}%
                </p>
                <p className="mt-1 text-[11px] text-white/40">{selectedConsultantName ? "Score atual" : "Score médio atual"}</p>
              </div>
              <div className="text-right">
                <TrendIndicator current={currentPoint?.avgScore ?? 0} previous={previousPoint?.avgScore ?? null} />
                {previousPoint && (
                  <p className="text-[10px] text-white/30 mt-0.5">vs {previousPoint.label}</p>
                )}
              </div>
            </div>

            {/* Chart */}
            <motion.div
              className="h-44"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              onAnimationComplete={() => setScoreAnimated(true)}
            >
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <AreaChart data={trendData} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="85%" stopColor="hsl(var(--primary))" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis domain={scoreDomain} tick={axisStyle} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }} />
                  <Area
                    type="monotone"
                    dataKey="avgScore"
                    name="Score médio"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    fill="url(#scoreGradient)"
                    dot={{ r: 3.5, fill: "hsl(var(--primary))", strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: "hsl(var(--primary))", strokeWidth: 2, stroke: "hsl(var(--background))" }}
                    isAnimationActive={!scoreAnimated}
                    animationDuration={900}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Lists */}
            <div className="grid gap-3 lg:grid-cols-2">
              <ConsultantTrendList
                title="Consultores em alta"
                items={improvingConsultants}
                emptyText="Nenhum consultor evoluiu entre os últimos dois períodos."
                positive
              />
              <ConsultantTrendList
                title="Consultores em atenção"
                items={decliningConsultants}
                emptyText="Nenhum consultor caiu entre o período anterior e o atual."
                positive={false}
              />
            </div>
          </div>
        ) : trendData.length === 1 ? (
          <SinglePeriodCard
            label="Score médio atual"
            value={`${currentPoint?.avgScore ?? 0}%`}
            periodLabel={currentPoint?.label ?? ""}
            color="text-white/90"
          />
        ) : (
          <EmptyInsight text="Os scores são registrados automaticamente a cada ciclo. Quando o primeiro período for concluído, a evolução vai aparecer aqui." />
        )}
      </SectionCard>

      {/* ── Payout Evolution — payment manager only ── */}
      {!hideMonetary && (
      <SectionCard title={selectedConsultantName ? "Evolução do Payout (consultor)" : "Evolução do Payout"} icon={Wallet}>
        {hasHistory ? (
          <div className="space-y-4">
            {/* KPI row */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-3xl font-extrabold text-emerald-400 tabular-nums leading-none">
                  {money(currentPoint?.totalPayout ?? 0)}
                </p>
                <p className="mt-1 text-[11px] text-white/40">{selectedConsultantName ? "Payout atual" : "Payout total atual"}</p>
              </div>
              <div className="text-right">
                <TrendIndicator current={currentPoint?.totalPayout ?? 0} previous={previousPoint?.totalPayout ?? null} />
                {previousPoint && (
                  <p className="text-[10px] text-white/30 mt-0.5">vs {previousPoint.label}: {money(previousPoint.totalPayout)}</p>
                )}
              </div>
            </div>

            {/* Chart */}
            <motion.div
              className="h-44"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              onAnimationComplete={() => setPayoutAnimated(true)}
            >
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <AreaChart data={trendData} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="payoutGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(142,71%,45%)" stopOpacity={0.35} />
                      <stop offset="85%" stopColor="hsl(142,71%,45%)" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} />
                  <YAxis domain={payoutDomain} tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }} />
                  <Area
                    type="monotone"
                    dataKey="totalPayout"
                    name="Payout total"
                    stroke="hsl(142,71%,45%)"
                    strokeWidth={2.5}
                    fill="url(#payoutGradient)"
                    dot={{ r: 3.5, fill: "hsl(142,71%,45%)", strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: "hsl(142,71%,45%)", strokeWidth: 2, stroke: "hsl(var(--background))" }}
                    isAnimationActive={!payoutAnimated}
                    animationDuration={900}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Payout summary tiles */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                {
                  label: "Maior payout",
                  value: money(Math.max(...trendData.map((d) => d.totalPayout))),
                  sub: trendData.find((d) => d.totalPayout === Math.max(...trendData.map((x) => x.totalPayout)))?.label ?? "—",
                  color: "text-emerald-400",
                  border: "border-emerald-500/15",
                  bg: "bg-emerald-500/[0.04]",
                },
                {
                  label: "Menor payout",
                  value: money(Math.min(...trendData.map((d) => d.totalPayout))),
                  sub: trendData.find((d) => d.totalPayout === Math.min(...trendData.map((x) => x.totalPayout)))?.label ?? "—",
                  color: "text-white/70",
                  border: "border-white/[0.06]",
                  bg: "bg-white/[0.02]",
                },
                {
                  label: "Variação total",
                  value: (() => {
                    const first = trendData[0]?.totalPayout ?? 0;
                    const last = trendData[trendData.length - 1]?.totalPayout ?? 0;
                    const diff = last - first;
                    return `${diff >= 0 ? "+" : ""}${money(diff)}`;
                  })(),
                  sub: `${trendData[0]?.label ?? "—"} → ${trendData[trendData.length - 1]?.label ?? "—"}`,
                  color: (() => { const d = (trendData[trendData.length - 1]?.totalPayout ?? 0) - (trendData[0]?.totalPayout ?? 0); return d >= 0 ? "text-emerald-400" : "text-red-400"; })(),
                  border: "border-white/[0.06]",
                  bg: "bg-white/[0.02]",
                },
                {
                  label: "Períodos",
                  value: String(trendData.length),
                  sub: "meses com dados",
                  color: "text-white/70",
                  border: "border-white/[0.06]",
                  bg: "bg-white/[0.02]",
                },
              ].map((tile, i) => (
                <motion.div
                  key={tile.label}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: 0.1 + i * 0.06 }}
                  className={`rounded-xl border ${tile.border} ${tile.bg} px-3 py-3`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35 mb-1">{tile.label}</p>
                  <p className={`text-sm font-bold tabular-nums leading-tight ${tile.color}`}>{tile.value}</p>
                  <p className="text-[10px] text-white/30 mt-0.5">{tile.sub}</p>
                </motion.div>
              ))}
            </div>
          </div>
        ) : trendData.length === 1 ? (
          <SinglePeriodCard
            label="Payout total atual"
            value={money(currentPoint?.totalPayout ?? 0)}
            periodLabel={currentPoint?.label ?? ""}
            color="text-emerald-400"
          />
        ) : (
          <EmptyInsight text="Os valores de payout são gravados automaticamente. A partir do segundo período registrado, o gráfico de evolução vai aparecer aqui." />
        )}
      </SectionCard>
      )}

      </div>
    </motion.div>
  );
}
