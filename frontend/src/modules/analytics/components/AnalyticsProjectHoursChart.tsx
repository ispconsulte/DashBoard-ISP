import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { motion } from "framer-motion";
import { getElapsedEffectiveDate, formatHoursHuman } from "@/modules/tasks/utils";
import type { ProjectAnalytics } from "../types";
import type { ElapsedTimeRecord } from "@/modules/tasks/types";

type Props = {
  projects: ProjectAnalytics[];
  times?: ElapsedTimeRecord[];
};

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      className="rounded-xl px-4 py-3 border border-white/10 shadow-2xl backdrop-blur-xl"
      style={{
        background: "linear-gradient(145deg, hsl(270 50% 14% / 0.95), hsl(234 45% 10% / 0.95))",
      }}
    >
      <p className="text-xs font-bold text-white/90 mb-1">{d.fullName ?? d.name}</p>
      {d.client && <p className="text-xs text-white/40">{d.client}</p>}
      <div className="flex gap-4 mt-2">
        <span className="text-sm font-bold text-white">{formatHoursHuman(d.hours)}</span>
        {d.tasks != null && <span className="text-xs text-white/40">{d.tasks} tarefas</span>}
      </div>
    </div>
  );
};

const barColors = [
  "hsl(262 83% 58%)",
  "hsl(250 80% 55%)",
  "hsl(234 89% 64%)",
  "hsl(270 80% 55%)",
  "hsl(200 80% 55%)",
  "hsl(160 84% 39%)",
  "hsl(280 70% 50%)",
  "hsl(220 80% 55%)",
];

export default function AnalyticsProjectHoursChart({ projects, times = [] }: Props) {
  const data = useMemo(() => {
    return [...projects]
      .filter((p) => p.hoursUsed > 0)
      .sort((a, b) => b.hoursUsed - a.hoursUsed)
      .slice(0, 8)
      .map((p) => ({
        name: p.projectName.length > 16 ? p.projectName.slice(0, 16) + "…" : p.projectName,
        fullName: p.projectName,
        client: p.clientName,
        hours: Math.round(p.hoursUsed),
        tasks: p.tasksDone + p.tasksPending + p.tasksOverdue,
      }));
  }, [projects]);

  const weeklyData = useMemo(() => {
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
    return WEEKDAYS.map((name, i) => ({
      name,
      hours: Math.round(daily[i] * 10) / 10,
      isToday: i === today,
    }));
  }, [times]);

  const totalWeekHours = useMemo(() => weeklyData.reduce((s, d) => s + d.hours, 0), [weeklyData]);

  if (data.length === 0 && totalWeekHours === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.35 }}
      className="rounded-2xl border border-white/[0.06] p-6 transition-all hover:border-white/[0.10]"
      style={{ background: "linear-gradient(145deg, hsl(270 50% 14% / 0.8), hsl(234 45% 10% / 0.6))" }}
    >
      <div className="mb-4">
        <h3 className="text-lg font-bold text-white/90">Horas por Projeto</h3>
        <p className="text-xs text-white/30 mt-0.5">Top projetos · atividade semanal: {formatHoursHuman(totalWeekHours)}</p>
      </div>

      {/* Weekly mini chart */}
      {totalWeekHours > 0 && (
        <div className="mb-5">
          <p className="text-[10px] uppercase tracking-wider text-white/25 mb-2">Esta semana</p>
          <div className="h-[80px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <BarChart data={weeklyData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fill: "hsl(270 10% 35%)", fontSize: 9, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(270 20% 15% / 0.4)" }} />
                <Bar dataKey="hours" radius={[4, 4, 1, 1]} maxBarSize={24} isAnimationActive animationDuration={1000}>
                  {weeklyData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.isToday ? "hsl(160 84% 39%)" : "hsl(262 83% 58%)"}
                      fillOpacity={entry.isToday ? 1 : 0.5}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Project hours horizontal bars */}
      {data.length > 0 && (
        <div style={{ height: Math.max(200, data.length * 42) }} className="w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
              <XAxis
                type="number"
                tick={{ fill: "hsl(270 10% 30%)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: "hsl(270 10% 45%)", fontSize: 11, fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                width={120}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(270 20% 15% / 0.5)" }} />
              <Bar
                dataKey="hours"
                radius={[0, 8, 8, 0]}
                isAnimationActive
                animationDuration={1500}
                animationEasing="ease-out"
                animationBegin={500}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={barColors[i % barColors.length]} />
                ))}
                <LabelList dataKey="hours" position="right" formatter={(v: number) => formatHoursHuman(v)} style={{ fill: "hsl(270 10% 55%)", fontSize: 11, fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
}
