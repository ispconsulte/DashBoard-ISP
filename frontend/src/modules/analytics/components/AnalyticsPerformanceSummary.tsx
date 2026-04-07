import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { ProjectAnalytics } from "../types";

type Props = {
  projects: ProjectAnalytics[];
  totalDone: number;
  totalTasks: number;
  totalHours: number;
};

export default function AnalyticsPerformanceSummary({ projects, totalDone, totalTasks, totalHours }: Props) {
  const avgPerformance = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0;
  const goodProjects = projects.filter((p) => p.performance === "good").length;
  const badProjects = projects.filter((p) => p.performance === "bad").length;

  const performanceLabel =
    avgPerformance >= 75 ? "Excelente" : avgPerformance >= 50 ? "Bom" : avgPerformance >= 25 ? "Regular" : "Crítico";

  const performanceColor =
    avgPerformance >= 75
      ? "hsl(160 84% 39%)"
      : avgPerformance >= 50
        ? "hsl(200 80% 55%)"
        : avgPerformance >= 25
          ? "hsl(45 100% 55%)"
          : "hsl(0 84% 60%)";

  const metrics = [
    { label: "Total Tarefas", value: totalTasks.toLocaleString("pt-BR") },
    { label: "Conclusão", value: `${avgPerformance}%` },
    { label: "Horas", value: `${Math.round(totalHours)}h` },
    { label: "Proj. Bom", value: goodProjects.toString() },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.35 }}
      className="rounded-2xl border border-white/[0.06] p-6 transition-all hover:border-white/[0.10]"
      style={{ background: "linear-gradient(145deg, hsl(270 50% 14% / 0.8), hsl(234 45% 10% / 0.6))" }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: "hsl(262 83% 58% / 0.15)" }}
        >
          <Sparkles className="h-4 w-4" style={{ color: "hsl(262 83% 58%)" }} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white/90">Performance Geral</h3>
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ color: performanceColor, background: `${performanceColor.replace(")", " / 0.15)")}` }}
            >
              {performanceLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Big percentage */}
      <div className="flex items-baseline gap-2 mb-5">
        <motion.span
          className="text-5xl font-black text-white/90"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
        >
          {avgPerformance}%
        </motion.span>
        <span className="text-xs text-white/30">taxa de conclusão</span>
      </div>

      {/* Performance description */}
      <p className="text-xs text-white/35 mb-5 leading-relaxed">
        {goodProjects > 0 && `${goodProjects} projeto${goodProjects > 1 ? "s" : ""} com bom desempenho. `}
        {badProjects > 0 && `${badProjects} projeto${badProjects > 1 ? "s" : ""} em situação crítica. `}
        {badProjects === 0 && goodProjects > 0 && "Nenhum projeto em situação crítica."}
      </p>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-2">
        {metrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 + i * 0.08 }}
            className="rounded-xl border border-white/[0.04] bg-white/[0.02] px-3 py-2.5"
          >
            <p className="text-sm font-bold text-white/80">{m.value}</p>
            <p className="text-[9px] text-white/25">{m.label}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
