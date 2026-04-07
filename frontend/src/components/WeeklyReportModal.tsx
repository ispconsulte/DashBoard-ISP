import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FileText, TrendingUp, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import type { TaskView } from "@/modules/tasks/types";
import { useScrollLock } from "@/hooks/useScrollLock";

type Props = {
  open: boolean;
  onClose: () => void;
  tasks: TaskView[];
  userName?: string;
};

type ProjectSummary = {
  name: string;
  total: number;
  done: number;
  overdue: number;
  pending: number;
  progress: number;
};

export default function WeeklyReportModal({ open, onClose, tasks, userName }: Props) {
  useScrollLock(open);

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const report = useMemo(() => {
    // All active tasks (for overall status)
    const byProject: Record<string, TaskView[]> = {};
    tasks.forEach((t) => {
      const project = (t.project || "").trim() || "Sem projeto";
      if (project.toLowerCase() === "projeto indefinido") return;
      if (!byProject[project]) byProject[project] = [];
      byProject[project].push(t);
    });

    const summaries: ProjectSummary[] = Object.entries(byProject)
      .map(([name, items]) => {
        const done = items.filter((t) => t.statusKey === "done").length;
        const overdue = items.filter((t) => t.statusKey === "overdue").length;
        const pending = items.filter((t) => t.statusKey === "pending" || t.statusKey === "unknown").length;
        const total = items.length;
        const progress = total > 0 ? Math.round((done / total) * 100) : 0;
        return { name, total, done, overdue, pending, progress };
      })
      .sort((a, b) => b.overdue - a.overdue || b.total - a.total);

    const totalTasks = tasks.length;
    const totalDone = tasks.filter((t) => t.statusKey === "done").length;
    const totalOverdue = tasks.filter((t) => t.statusKey === "overdue").length;
    const totalPending = totalTasks - totalDone - totalOverdue;
    const overallProgress = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0;

    return { summaries, totalTasks, totalDone, totalOverdue, totalPending, overallProgress };
  }, [tasks]);

  const dateStr = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative w-full max-w-[600px] max-h-[85vh] overflow-hidden rounded-2xl border border-white/[0.08] shadow-2xl"
            style={{
              background: "linear-gradient(160deg, hsl(234 50% 13%), hsl(260 45% 10%))",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 border border-primary/20">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Relatório Semanal</h2>
                  <p className="text-[11px] text-white/40">{dateStr}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 transition hover:bg-white/[0.06] hover:text-white/60"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(85vh-80px)] px-6 py-5 space-y-6">
              {/* Overall KPIs */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Total", value: report.totalTasks, icon: FileText, color: "text-blue-400", bg: "bg-blue-500/10" },
                  { label: "Concluídas", value: report.totalDone, icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10" },
                  { label: "Atrasadas", value: report.totalOverdue, icon: AlertTriangle, color: "text-rose-400", bg: "bg-rose-500/10" },
                  { label: "Pendentes", value: report.totalPending, icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10" },
                ].map((kpi) => (
                  <div key={kpi.label} className="rounded-xl border border-white/[0.06] p-3 text-center">
                    <kpi.icon className={`h-4 w-4 mx-auto mb-1 ${kpi.color}`} />
                    <p className="text-lg font-bold text-white">{kpi.value}</p>
                    <p className="text-[10px] text-white/40">{kpi.label}</p>
                  </div>
                ))}
              </div>

              {/* Overall progress bar */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-white/60">Progresso Geral</span>
                  <span className="text-xs font-bold text-primary">{report.overallProgress}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/[0.06] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${report.overallProgress}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400"
                  />
                </div>
              </div>

              {/* Per-project breakdown */}
              <div>
                <h3 className="text-sm font-bold text-white/80 mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary/60" />
                  Por Projeto
                </h3>
                <div className="space-y-3">
                  {report.summaries.length === 0 ? (
                    <p className="text-xs text-white/30 text-center py-4">Nenhum projeto encontrado.</p>
                  ) : (
                    report.summaries.map((proj) => (
                      <div
                        key={proj.name}
                        className="rounded-xl border border-white/[0.06] p-3 hover:bg-white/[0.02] transition"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-white/70 truncate max-w-[300px]">
                            {proj.name}
                          </span>
                          <span className="text-[11px] font-bold text-primary">{proj.progress}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden mb-2">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-500"
                            style={{ width: `${proj.progress}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-3 text-[10px]">
                          <span className="text-emerald-400">✓ {proj.done}</span>
                          <span className="text-rose-400">⚠ {proj.overdue}</span>
                          <span className="text-amber-400">◎ {proj.pending}</span>
                          <span className="text-white/30 ml-auto">{proj.total} tarefas</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {userName && (
                <p className="text-[10px] text-white/20 text-center pt-2">
                  Gerado para {userName} em {dateStr}
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
