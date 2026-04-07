import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Clock, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Info, X } from "lucide-react";
import type { TaskRecord } from "@/modules/tasks/types";

type Props = {
  tasks: TaskRecord[];
  classifyTask: (t: TaskRecord) => "done" | "overdue" | "pending";
};

const PAGE_SIZE = 10;

export default function AnalyticsPendingTasks({ tasks, classifyTask }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [page, setPage] = useState(0);
  const [showInfo, setShowInfo] = useState(false);

  const pendingTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        const c = classifyTask(t);
        return c === "pending" || c === "overdue";
      })
      .map((t) => ({
        ...t,
        _status: classifyTask(t) as "pending" | "overdue",
        _title: String(t.title ?? t.nome ?? t.name ?? "Sem título"),
        _project: String(t.project_name ?? t.projects?.name ?? t.project ?? t.projeto ?? "—"),
        _responsible: String(t.responsible_name ?? t.responsavel ?? t.consultant ?? "—"),
        _deadline: t.deadline ?? t.due_date ?? t.dueDate,
      }))
      .sort((a, b) => {
        if (a._status !== b._status) return a._status === "overdue" ? -1 : 1;
        const da = a._deadline ? new Date(String(a._deadline)).getTime() : Infinity;
        const db = b._deadline ? new Date(String(b._deadline)).getTime() : Infinity;
        return da - db;
      });
  }, [tasks, classifyTask]);

  const totalPages = Math.max(1, Math.ceil(pendingTasks.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visible = pendingTasks.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const overdueCount = pendingTasks.filter((t) => t._status === "overdue").length;
  const pendingCount = pendingTasks.filter((t) => t._status === "pending").length;

  // Reset page when tasks change
  useMemo(() => { if (page >= totalPages) setPage(0); }, [pendingTasks.length]);

  if (pendingTasks.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.45 }}
      className="relative overflow-hidden rounded-2xl border border-white/[0.06]"
      style={{ background: "linear-gradient(145deg, hsl(270 50% 14% / 0.7), hsl(234 45% 10% / 0.5))" }}
    >
      <button
        onClick={() => setShowInfo(true)}
        className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-lg text-white/25 transition-all hover:bg-white/[0.08] hover:text-white/60"
        aria-label="Mais informações sobre a lista"
      >
        <Info className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0 z-20 flex flex-col overflow-y-auto rounded-2xl styled-scrollbar"
            style={{ background: "hsl(260 30% 10% / 0.97)", backdropFilter: "blur(8px)" }}
          >
            <div className="flex-1 p-5">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-bold text-white/90">Sobre esta lista</h4>
                <button
                  onClick={() => setShowInfo(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-white/90"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2.5 text-[11px] leading-relaxed text-white/60">
                <p>
                  Esta lista mostra apenas tarefas <strong className="text-white/80">pendentes e atrasadas</strong> para foco em risco operacional.
                </p>
                <ul className="list-disc space-y-1 pl-4 marker:text-white/50">
                  <li><strong className="text-rose-400">Atrasadas</strong> aparecem no topo.</li>
                  <li>Em seguida, tarefas pendentes com prazo mais próximo.</li>
                  <li>As contagens no topo resumem o volume crítico do período.</li>
                </ul>
                <p className="text-white/45">
                  Use este bloco para priorizar rapidamente o que deve ser tratado hoje.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 pr-12 transition hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold text-white/90">Tarefas Pendentes</h3>
          <div className="flex gap-1.5">
            {overdueCount > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-[hsl(0_84%_60%/0.15)] px-2 py-0.5 text-[10px] font-bold text-[hsl(0_84%_60%)]">
                <AlertTriangle className="h-3 w-3" /> {overdueCount} atrasada{overdueCount > 1 ? "s" : ""}
              </span>
            )}
            <span className="flex items-center gap-1 rounded-full bg-[hsl(262_83%_58%/0.15)] px-2 py-0.5 text-[10px] font-bold text-[hsl(262_83%_58%)]">
              <Clock className="h-3 w-3" /> {pendingCount} em andamento
            </span>
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-white/30" /> : <ChevronDown className="h-4 w-4 text-white/30" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.04]">
              <div className="grid grid-cols-[2fr_1.5fr_1fr_90px] gap-3 px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-white/30">
                <span>Tarefa</span>
                <span>Projeto</span>
                <span>Responsável</span>
                <span className="text-center">Prazo</span>
              </div>

              {visible.map((t, i) => {
                const deadlineStr = t._deadline
                  ? (() => {
                      const raw = String(t._deadline);
                      const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                      if (m) {
                        return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
                      }
                      return new Date(raw).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
                    })()
                  : "—";

                return (
                  <motion.div
                    key={`${t.task_id ?? t.id}-${i}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="grid grid-cols-[2fr_1.5fr_1fr_90px] gap-3 border-t border-white/[0.03] px-5 py-2.5 text-[13px] transition hover:bg-white/[0.02]"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <div
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: t._status === "overdue" ? "hsl(0 84% 60%)" : "hsl(262 83% 58%)" }}
                      />
                      <span className="truncate text-white/70">{t._title}</span>
                    </div>
                    <span className="truncate text-white/40">{t._project}</span>
                    <span className="truncate text-white/40">{t._responsible}</span>
                    <span className="text-center font-medium" style={{ color: t._status === "overdue" ? "hsl(0 84% 60%)" : "hsl(262 83% 58% / 0.7)" }}>
                      {deadlineStr}
                    </span>
                  </motion.div>
                );
              })}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-white/[0.03] px-5 py-3">
                  <span className="text-[11px] text-white/30">
                    {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, pendingTasks.length)} de {pendingTasks.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={safePage === 0}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-white/40 transition hover:bg-white/[0.08] hover:text-white/70 disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <span className="px-2 text-[11px] font-bold text-white/50">
                      {safePage + 1} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={safePage >= totalPages - 1}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-white/40 transition hover:bg-white/[0.08] hover:text-white/70 disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
