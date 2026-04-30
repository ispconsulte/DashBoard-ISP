import { useMemo, useEffect, useRef, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { motion } from "framer-motion";
import type { ProjectAnalytics } from "../types";
import { storage } from "@/modules/shared/storage";

type Props = {
  projects: ProjectAnalytics[];
};

type ChartItem = {
  name: string;
  Concluídas: number;
  Andamento: number;
  Atrasadas: number;
};

const CACHE_KEY = "cache:tasksByProjectChart";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-4 py-3 border border-white/10 shadow-2xl backdrop-blur-xl"
      style={{
        background: "linear-gradient(145deg, hsl(270 50% 14% / 0.95), hsl(234 45% 10% / 0.95))",
      }}
    >
      <p className="text-xs font-bold text-white/80 mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ background: p.fill || p.color }} />
          <span className="text-white/50">{p.name}:</span>
          <span className="font-bold text-white">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

function buildData(projects: ProjectAnalytics[]): ChartItem[] {
  return [...projects]
    .filter((p) => {
      const total = (Number(p.tasksDone) || 0) + (Number(p.tasksPending) || 0) + (Number(p.tasksOverdue) || 0);
      return total > 0;
    })
    .sort((a, b) => {
      const totalA = (Number(a.tasksDone) || 0) + (Number(a.tasksPending) || 0) + (Number(a.tasksOverdue) || 0);
      const totalB = (Number(b.tasksDone) || 0) + (Number(b.tasksPending) || 0) + (Number(b.tasksOverdue) || 0);
      return totalB - totalA;
    })
    .slice(0, 10)
    .map((p) => ({
      name: p.projectName.length > 14 ? p.projectName.slice(0, 14) + "…" : p.projectName,
      Concluídas: Number(p.tasksDone) || 0,
      Andamento: Number(p.tasksPending) || 0,
      Atrasadas: Number(p.tasksOverdue) || 0,
    }));
}

export default function AnalyticsTasksByProjectChart({ projects }: Props) {
  // Use cached chart data for instant render
  const [data, setData] = useState<ChartItem[]>(() => {
    return storage.get<ChartItem[]>(CACHE_KEY, []);
  });

  const freshData = useMemo(() => buildData(projects), [projects]);

  // Update when fresh data arrives
  useEffect(() => {
    if (freshData.length > 0) {
      setData(freshData);
      storage.set(CACHE_KEY, freshData);
    }
  }, [freshData]);

  if (data.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-white/[0.06] p-6 transition-all hover:border-white/[0.10]"
      style={{ background: "linear-gradient(145deg, hsl(270 50% 14% / 0.8), hsl(234 45% 10% / 0.6))" }}
    >
      <div className="mb-4">
        <h3 className="text-lg font-bold text-white/90">Tarefas por Projeto</h3>
        <p className="text-xs text-white/30 mt-0.5">Distribuição de status por projeto</p>
      </div>

      <div className="h-[350px] w-full">
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <XAxis
              dataKey="name"
              tick={{ fill: "hsl(270 10% 40%)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              angle={-30}
              textAnchor="end"
              height={50}
            />
            <YAxis
              tick={{ fill: "hsl(270 10% 30%)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={30}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(270 20% 15% / 0.4)" }} />
            <Legend
              wrapperStyle={{ fontSize: 11, color: "hsl(270 10% 50%)" }}
              iconType="circle"
              iconSize={8}
            />
            <Bar dataKey="Concluídas" stackId="a" fill="hsl(160 84% 39%)" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Andamento" stackId="a" fill="hsl(262 83% 58%)" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Atrasadas" stackId="a" fill="hsl(0 84% 60%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
