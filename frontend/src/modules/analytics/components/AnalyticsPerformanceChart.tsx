import { memo, useMemo, useState, useEffect } from "react";
import { dateToLocalIso, formatIsoToPtBr, getElapsedEffectiveDate } from "@/modules/tasks/utils";
import EmptyState from "@/components/ui/EmptyState";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";
import type { ElapsedTimeRecord } from "@/modules/tasks/types";

type Props = {
  times: ElapsedTimeRecord[];
};

const periodOptions = [
  { key: "7d", label: "7D", days: 7 },
  { key: "30d", label: "1M", days: 30 },
  { key: "90d", label: "3M", days: 90 },
  { key: "180d", label: "6M", days: 180 },
  { key: "all", label: "All", days: 0 },
] as const;

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-4 py-3 border border-white/10 shadow-2xl backdrop-blur-xl"
      style={{
        background: "linear-gradient(145deg, hsl(270 50% 14% / 0.95), hsl(234 45% 10% / 0.95))",
      }}
    >
      <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{label}</p>
      <p className="text-lg font-bold text-white">
        {payload[0].value}
        <span className="text-xs text-white/50 ml-1">horas</span>
      </p>
    </div>
  );
};

function AnalyticsPerformanceChartInner({ times }: Props) {
  const [period, setPeriod] = useState<string>("180d");
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    setAnimKey((k) => k + 1);
  }, [period]);

  const chartData = useMemo(() => {
    const now = new Date();
    const selectedPeriod = periodOptions.find((p) => p.key === period);
    const cutoff =
      selectedPeriod && selectedPeriod.days > 0
        ? new Date(now.getTime() - selectedPeriod.days * 24 * 60 * 60 * 1000)
        : null;

    const daily: Record<string, number> = {};
    times.forEach((t) => {
      const d = getElapsedEffectiveDate(t);
      if (!d) return;
      if (cutoff && d < cutoff) return;
      const key = dateToLocalIso(d);
      daily[key] = (daily[key] ?? 0) + (t.seconds ?? 0) / 3600;
    });

    const sorted = Object.entries(daily)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, hours]) => {
        const label = formatIsoToPtBr(date);
        return { date: label, hours: Math.round(hours * 10) / 10 };
      });

    if (sorted.length > 40) {
      const step = Math.ceil(sorted.length / 40);
      const aggregated: typeof sorted = [];
      for (let i = 0; i < sorted.length; i += step) {
        const chunk = sorted.slice(i, i + step);
        const totalHours = chunk.reduce((s, c) => s + c.hours, 0);
        aggregated.push({ date: chunk[0].date, hours: Math.round(totalHours * 10) / 10 });
      }
      return aggregated;
    }
    return sorted;
  }, [times, period]);

  const totalHours = chartData.reduce((s, d) => s + d.hours, 0);
  const avgHours = chartData.length > 0 ? totalHours / chartData.length : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="rounded-2xl border border-white/[0.06] p-6 transition-all hover:border-white/[0.10]"
      style={{ background: "linear-gradient(145deg, hsl(270 50% 14% / 0.8), hsl(234 45% 10% / 0.6))" }}
    >
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div>
          <h3 className="text-lg font-bold text-white/90">Horas Registradas</h3>
          <p className="text-xs text-white/30 mt-0.5">Visualize a evolução do esforço ao longo do tempo — detecte picos de demanda e períodos ociosos</p>
        </div>
        <div className="flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.03] p-1">
          {periodOptions.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all ${
                period === p.key
                  ? "bg-gradient-to-r from-[hsl(262_83%_58%)] to-[hsl(234_89%_64%)] text-white shadow-lg shadow-[hsl(262_83%_58%/0.25)]"
                  : "text-white/25 hover:text-white/50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats inline */}
      <div className="flex gap-6 mb-4">
        <div>
          <span className="text-3xl font-black text-white/90">{Math.round(totalHours).toLocaleString("pt-BR")}h</span>
          <span className="text-xs text-white/30 ml-2">total</span>
        </div>
        <div className="flex items-end">
          <span className="text-sm font-semibold text-white/40">~{avgHours.toFixed(1)}h/dia</span>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 ? (
        <motion.div
          key={animKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="h-[350px] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="perfGradFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(262 83% 58%)" stopOpacity={0.5} />
                  <stop offset="40%" stopColor="hsl(250 80% 60%)" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="hsl(234 45% 10%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="perfGradStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="hsl(262 83% 68%)" />
                  <stop offset="100%" stopColor="hsl(200 80% 65%)" />
                </linearGradient>
                <filter id="chartGlow">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(270 15% 15%)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: "hsl(270 10% 30%)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "hsl(270 10% 30%)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={35}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="hours"
                stroke="url(#perfGradStroke)"
                strokeWidth={2.5}
                fill="url(#perfGradFill)"
                dot={false}
                activeDot={{
                  r: 6,
                  fill: "hsl(262 83% 58%)",
                  stroke: "hsl(262 83% 75%)",
                  strokeWidth: 3,
                }}
                isAnimationActive={true}
                animationDuration={2000}
                animationEasing="ease-out"
                animationBegin={300}
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      ) : (
        <EmptyState variant="chart" message="Nenhum dado para o período selecionado." hint="Tente selecionar um período diferente." className="h-[280px]" />
      )}
    </motion.div>
  );
}

export default memo(AnalyticsPerformanceChartInner);
