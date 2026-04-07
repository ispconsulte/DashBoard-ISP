import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { motion } from "framer-motion";
import { getElapsedEffectiveDate, formatHoursHuman } from "@/modules/tasks/utils";
import type { ElapsedTimeRecord } from "@/modules/tasks/types";

type Props = {
  times: ElapsedTimeRecord[];
  doneCount: number;
  totalTasks: number;
};

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

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
        {formatHoursHuman(payload[0].value)}
      </p>
    </div>
  );
};

export default function AnalyticsWeeklyChart({ times, doneCount, totalTasks }: Props) {
  const { weekData, totalWeekHours } = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const daily: number[] = [0, 0, 0, 0, 0, 0, 0];

    times.forEach((t) => {
      const d = getElapsedEffectiveDate(t);
      if (!d) return;
      if (d >= startOfWeek && d <= now) {
        daily[d.getDay()] += (t.seconds ?? 0) / 3600;
      }
    });

    const today = now.getDay();
    const weekData = WEEKDAYS.map((name, i) => ({
      name,
      hours: Math.round(daily[i] * 10) / 10,
      isToday: i === today,
    }));

    const totalWeekHours = daily.reduce((s, h) => s + h, 0);
    return { weekData, totalWeekHours };
  }, [times]);

  const completionPct = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="rounded-2xl border border-white/[0.06] p-6 transition-all hover:border-white/[0.10]"
      style={{ background: "linear-gradient(145deg, hsl(270 50% 14% / 0.8), hsl(234 45% 10% / 0.6))" }}
    >
      <div className="flex items-center justify-between mb-1">
        <div>
          <h3 className="text-lg font-bold text-white/90">Atividade Semanal</h3>
          <p className="text-xs text-white/30 mt-0.5">Acompanhe quantas horas foram investidas em cada dia — ideal para balancear a carga de trabalho</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-white/90">{formatHoursHuman(totalWeekHours)}</p>
          <p className="text-[10px] text-white/30">esta semana</p>
        </div>
      </div>

      {/* Completion mini bar */}
      <div className="flex items-center gap-3 mb-5 mt-3">
        <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${completionPct}%` }}
            transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, hsl(160 84% 39%), hsl(200 80% 55%))" }}
          />
        </div>
        <span className="text-[11px] font-bold text-white/40">{completionPct}% concluído</span>
      </div>

      {/* Bar chart */}
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weekData} margin={{ top: 8, right: 0, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="name"
              tick={{ fill: "hsl(270 10% 40%)", fontSize: 11, fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "hsl(270 10% 25%)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={30}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(270 20% 15% / 0.4)" }} />
            <Bar
              dataKey="hours"
              radius={[6, 6, 2, 2]}
              isAnimationActive={true}
              animationDuration={1200}
              animationEasing="ease-out"
              animationBegin={400}
              maxBarSize={36}
            >
              {weekData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.isToday ? "hsl(160 84% 39%)" : "hsl(262 83% 58%)"}
                  fillOpacity={entry.isToday ? 1 : 0.6}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm" style={{ background: "hsl(262 83% 58%)", opacity: 0.6 }} />
          <span className="text-[10px] text-white/30">Dias anteriores</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm" style={{ background: "hsl(160 84% 39%)" }} />
          <span className="text-[10px] text-white/30">Hoje</span>
        </div>
      </div>
    </motion.div>
  );
}
