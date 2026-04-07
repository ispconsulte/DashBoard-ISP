import { useState } from "react";
import { Star, TrendingUp, TrendingDown, Minus, Clock, Pencil } from "lucide-react";
import { motion } from "framer-motion";
import type { ProjectAnalytics } from "../types";

type Props = {
  project: ProjectAnalytics;
  onToggleFavorite: (id: number) => void;
  onClick?: (project: ProjectAnalytics) => void;
  onEditHours?: (project: ProjectAnalytics) => void;
  index?: number;
  isMine?: boolean;
  isAdmin?: boolean;
};

const perfConfig = {
  good: { label: "Bom", icon: TrendingUp, color: "from-emerald-500 to-[hsl(160_84%_39%)]", badge: "bg-emerald-500/15 text-emerald-400", accent: "hsl(160 84% 39%)" },
  neutral: { label: "Regular", icon: Minus, color: "from-amber-500 to-[hsl(43_97%_52%)]", badge: "bg-amber-500/15 text-amber-400", accent: "hsl(43 97% 52%)" },
  bad: { label: "Crítico", icon: TrendingDown, color: "from-[hsl(0_84%_60%)] to-amber-500", badge: "bg-[hsl(0_84%_60%/0.15)] text-[hsl(0_84%_60%)]", accent: "hsl(0 84% 60%)" },
};

export default function AnalyticsProjectCard({ project, onToggleFavorite, onClick, onEditHours, index = 0, isMine, isAdmin }: Props) {
  const perf = perfConfig[project.performance];
  const PerfIcon = perf.icon;
  const totalTasks = project.tasksDone + project.tasksPending + project.tasksOverdue;
  const completionPct = totalTasks > 0 ? Math.round((project.tasksDone / totalTasks) * 100) : 0;

  // Hours progress
  const hasContracted = project.hoursContracted > 0;
  const hoursPct = hasContracted ? Math.min(100, Math.round((project.hoursUsed / project.hoursContracted) * 100)) : 0;
  const hoursRemaining = hasContracted ? project.hoursContracted - project.hoursUsed : null;
  const hoursColor =
    hoursPct >= 90 ? "hsl(0 84% 60%)" :
    hoursPct >= 70 ? "hsl(43 97% 52%)" :
    "hsl(160 84% 39%)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      onClick={() => onClick?.(project)}
      className={`group relative cursor-pointer rounded-2xl border p-5 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/40 ${
        isMine ? "border-[hsl(262_83%_58%/0.3)] hover:border-[hsl(262_83%_58%/0.5)]" : "border-white/[0.06] hover:border-white/[0.12]"
      }`}
      style={{
        background: "linear-gradient(145deg, hsl(270 50% 14% / 0.9), hsl(234 45% 10% / 0.7))",
      }}
    >
      {/* Top accent */}
      <div
        className="absolute inset-x-0 top-0 h-[2px] rounded-t-2xl opacity-50 transition-opacity group-hover:opacity-100"
        style={{ background: `linear-gradient(to right, ${perf.accent}, hsl(262 83% 58%))` }}
      />

      {/* Corner glow */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-primary/5 blur-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

      <div className="relative z-10">
        {/* Header */}
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-[10px] uppercase tracking-[0.18em] text-primary/50 font-semibold truncate">{project.clientName || "Cliente"}</p>
          <div className="flex items-center gap-1 shrink-0">
            {isAdmin && (
              <button
                onClick={(e) => { e.stopPropagation(); onEditHours?.(project); }}
                className="rounded-lg p-1 text-white/15 transition hover:text-primary/70 hover:bg-primary/10"
                title="Editar horas contratadas"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(project.projectId); }} className="transition hover:scale-110">
              <Star
                className={`h-4 w-4 transition ${
                  project.isFavorite
                    ? "fill-amber-400 text-amber-400"
                    : "text-white/15 hover:text-amber-400/60"
                }`}
              />
            </button>
          </div>
        </div>
        <h4 className="truncate text-sm font-bold text-white/90">{project.projectName}</h4>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {isMine && (
            <span className="rounded-full bg-[hsl(262_83%_58%/0.2)] border border-[hsl(262_83%_58%/0.3)] px-2 py-0.5 text-[10px] font-bold text-[hsl(262_83%_58%)]">
              Meu
            </span>
          )}
          {project.isActive && (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
              Ativo
            </span>
          )}
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${perf.badge}`}>
            <PerfIcon className="h-3 w-3" />
            {perf.label}
          </span>
        </div>

        {/* Task stats */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { value: project.tasksDone, label: "Concluídas", color: "text-emerald-400", bg: "bg-emerald-500/10" },
            { value: project.tasksPending, label: "Andamento", color: "text-[hsl(262_83%_58%)]", bg: "bg-[hsl(262_83%_58%/0.1)]" },
            { value: project.tasksOverdue, label: "Atrasadas", color: "text-[hsl(0_84%_60%)]", bg: "bg-[hsl(0_84%_60%/0.1)]" },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl ${s.bg} border border-white/[0.04] px-3 py-2.5 text-center`}>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-white/35">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Completion progress */}
        <div className="mt-3 space-y-1">
          <div className="flex justify-between text-[10px]">
            <span className="text-white/35">Conclusão de tarefas</span>
            <span className="font-bold text-white/60">{completionPct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${completionPct}%` }}
              transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-primary to-[hsl(262_83%_58%)]"
            />
          </div>
        </div>

        {/* Hours block */}
        <div className="mt-3 rounded-xl border border-white/[0.04] bg-white/[0.03] px-3 py-2.5 space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-white/25 shrink-0" />
            <span className="text-xs text-white/35 flex-1">Horas utilizadas</span>
            <span className="text-sm font-bold text-white/80">{project.hoursUsed >= 1 ? `${Math.round(project.hoursUsed)}h` : `${Math.round(project.hoursUsed * 60)}min`}</span>
            {hasContracted && (
              <span className="text-xs text-white/30">/ {project.hoursContracted >= 1 ? `${project.hoursContracted}h` : `${Math.round(project.hoursContracted * 60)}min`}</span>
            )}
          </div>

          {hasContracted && (
            <div className="space-y-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${hoursPct}%` }}
                  transition={{ duration: 0.9, delay: 0.4, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(to right, ${hoursColor}, ${hoursColor}cc)` }}
                />
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-white/25">{hoursPct}% utilizado</span>
                <span className={`font-semibold ${hoursRemaining !== null && hoursRemaining < 0 ? "text-red-400" : "text-white/40"}`}>
                  {hoursRemaining !== null
                    ? hoursRemaining >= 0
                      ? `${hoursRemaining >= 1 ? Math.round(hoursRemaining) + "h" : Math.round(hoursRemaining * 60) + "min"} restantes`
                      : `${Math.abs(hoursRemaining) >= 1 ? Math.abs(Math.round(hoursRemaining)) + "h" : Math.abs(Math.round(hoursRemaining * 60)) + "min"} excedidas`
                    : ""}
                </span>
              </div>
            </div>
          )}

          {!hasContracted && isAdmin && (
            <button
              onClick={(e) => { e.stopPropagation(); onEditHours?.(project); }}
              className="w-full rounded-lg border border-dashed border-white/[0.08] py-1.5 text-[10px] text-white/25 transition hover:border-primary/30 hover:text-primary/60"
            >
              + Definir horas contratadas
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
