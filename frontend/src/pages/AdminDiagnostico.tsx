import { useMemo, useState } from "react";
import PageHeaderCard from "@/components/PageHeaderCard";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useTasks } from "@/modules/tasks/api/useTasks";
import { Navigate } from "react-router-dom";
import {
  Unlink,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
  CheckCircle2,
  Bug,
} from "lucide-react";
import {
  parseDateValue,
  formatDatePtBR,
  normalizeTaskTitle,
} from "@/modules/tasks/utils";

const INTERNAL_PROJECT_ALIASES = ["sp", "isp", "interno", "internal"];
const ORPHAN_PAGE_SIZE = 12;

export default function AdminDiagnostico() {
  const { session, loadingSession } = useAuth();
  const isAdmin =
    session?.role === "admin" ||
    session?.role === "gerente" ||
    session?.role === "coordenador";

  const { tasks, loading, reload } = useTasks({
    accessToken: session?.accessToken ?? null,
    period: "30d",
  });

  const [page, setPage] = useState(1);

  const orphanTasks = useMemo(() => {
    if (!tasks.length) return [];
    return tasks
      .map((task) => {
        const rawProjectId = String(task["project_id"] ?? task["projectId"] ?? "").trim();
        const projectFromJoin =
          task.projects && typeof task.projects === "object"
            ? String((task.projects as Record<string, unknown>)?.["name"] ?? "").trim()
            : "";
        const projectName = (
          (task["project_name"] ?? task["project"] ?? task["group_name"] ?? "").toString()
        ).trim();
        const effectiveName = projectFromJoin || projectName;
        const projectNorm = effectiveName
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        const hasNoProject = !effectiveName;
        const isInternalProject = INTERNAL_PROJECT_ALIASES.some(
          (alias) => projectNorm === alias || projectNorm === alias + " consulte"
        );
        if (!hasNoProject && !isInternalProject) return null;
        return {
          task_id: String(task["task_id"] ?? task["id"] ?? ""),
          title: normalizeTaskTitle(String(task["title"] ?? task["nome"] ?? "Sem título")),
          consultant: String(task["responsible_name"] ?? task["consultant"] ?? "—"),
          deadline: parseDateValue(task["deadline"] ?? task["due_date"] ?? task["dueDate"]),
          projectRaw: effectiveName || (rawProjectId ? `#${rawProjectId}` : "—"),
          reason: hasNoProject ? "Sem projeto vinculado" : `Projeto interno: "${effectiveName}"`,
          isInternal: isInternalProject,
        };
      })
      .filter(Boolean) as {
        task_id: string;
        title: string;
        consultant: string;
        deadline: Date | null;
        projectRaw: string;
        reason: string;
        isInternal: boolean;
      }[];
  }, [tasks]);

  const totalPages = Math.max(1, Math.ceil(orphanTasks.length / ORPHAN_PAGE_SIZE));
  const paginated = useMemo(() => {
    const start = (page - 1) * ORPHAN_PAGE_SIZE;
    return orphanTasks.slice(start, start + ORPHAN_PAGE_SIZE);
  }, [orphanTasks, page]);

  // Guard — aguarda sessão antes de redirecionar
  if (loadingSession) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="page-gradient w-full">

      <div className="mx-auto w-full max-w-[1900px] space-y-6 px-4 py-10 sm:px-5 md:px-8">
        <PageHeaderCard
          icon={Bug}
          title="Diagnóstico de Tarefas"
          subtitle="Tarefas sem projeto vinculado · últimos 30 dias · somente administradores"
          actions={
            <button
              type="button"
              onClick={() => reload()}
              disabled={loading}
              className="group flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-white/50 transition-all hover:border-white/[0.15] hover:bg-white/[0.05] hover:text-white/70 disabled:opacity-40"
            >
              <RefreshCw className={`h-3.5 w-3.5 transition-transform group-hover:scale-110 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Carregando…" : "Atualizar"}
            </button>
          }
        />

        {/* ── Alert banner ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex items-start gap-3.5 rounded-2xl px-5 py-4"
          style={{
            background: "linear-gradient(135deg, hsl(38 92% 50% / 0.08), hsl(38 92% 50% / 0.03))",
            boxShadow: "0 0 0 1px hsl(38 92% 50% / 0.18)",
          }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "hsl(38 92% 60%)" }} />
          <div className="text-xs leading-relaxed" style={{ color: "hsl(38 80% 70% / 0.75)" }}>
            <strong style={{ color: "hsl(38 92% 62%)" }}>O que são tarefas órfãs?</strong>{" "}
            Tarefas cujo campo{" "}
            <code
              className="rounded px-1.5 py-0.5 font-mono text-[10px]"
              style={{ background: "hsl(38 92% 50% / 0.12)", color: "hsl(38 92% 62%)" }}
            >
              project_id
            </code>{" "}
            no banco de dados não corresponde a nenhum projeto ativo, ou aponta para um alias interno como{" "}
            <code
              className="rounded px-1.5 py-0.5 font-mono text-[10px]"
              style={{ background: "hsl(38 92% 50% / 0.12)", color: "hsl(38 92% 62%)" }}
            >
              SP
            </code>
            .{" "}
            <strong style={{ color: "hsl(38 92% 62%)" }}>Ação:</strong> corrija o vínculo de cada tarefa diretamente
            na fonte de dados externa.
          </div>
        </motion.div>

        {/* ── Stats row ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.18 }}
          className="flex items-center gap-3"
        >
          <span className="text-sm font-medium" style={{ color: "hsl(215 20% 55%)" }}>
            Tarefas sem vínculo
          </span>
          {loading ? (
            <span
              className="animate-pulse rounded-full px-3 py-1 text-xs font-bold"
              style={{ background: "hsl(222 30% 14%)", color: "hsl(215 20% 45%)" }}
            >
              …
            </span>
          ) : orphanTasks.length === 0 ? (
            <span
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
              style={{
                background: "hsl(160 60% 40% / 0.15)",
                boxShadow: "0 0 0 1px hsl(160 60% 40% / 0.25)",
                color: "hsl(160 60% 60%)",
              }}
            >
              <CheckCircle2 className="h-3 w-3" /> Nenhuma encontrada
            </span>
          ) : (
            <span
              className="rounded-full px-3 py-1 text-xs font-bold"
              style={{
                background: "hsl(38 92% 50% / 0.15)",
                boxShadow: "0 0 0 1px hsl(38 92% 50% / 0.25)",
                color: "hsl(38 92% 62%)",
              }}
            >
              {orphanTasks.length}
            </span>
          )}
        </motion.div>

        {/* ── Table card ── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.22 }}
          className="overflow-hidden rounded-2xl"
          style={{
            background: "hsl(222 40% 8%)",
            boxShadow: "0 0 0 1px hsl(222 25% 13%), 0 20px 40px hsl(222 47% 3% / 0.5)",
          }}
        >
        {/* Table header — hidden on mobile, cards used instead */}
          <div
            className="hidden sm:grid grid-cols-[1fr_160px_110px_180px] gap-2 px-5 py-3.5"
            style={{
              background: "hsl(222 40% 10%)",
              borderBottom: "1px solid hsl(222 25% 12%)",
            }}
          >
            {["Tarefa", "Responsável", "Prazo", "Motivo"].map((col) => (
              <span
                key={col}
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: "hsl(215 20% 40%)" }}
              >
                {col}
              </span>
            ))}
          </div>

          {/* Table body */}
          {loading && tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
                className="h-7 w-7 rounded-full"
                style={{ boxShadow: "0 0 0 2px hsl(38 92% 50% / 0.2), inset 0 0 0 2px hsl(38 92% 50% / 0.6)" }}
              />
              <p className="text-sm" style={{ color: "hsl(215 20% 45%)" }}>
                Carregando tarefas…
              </p>
            </div>
          ) : orphanTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{
                  background: "hsl(160 60% 40% / 0.1)",
                  boxShadow: "0 0 0 1px hsl(160 60% 40% / 0.2)",
                }}
              >
                <CheckCircle2 className="h-6 w-6" style={{ color: "hsl(160 60% 55%)" }} />
              </div>
              <p className="text-sm font-semibold" style={{ color: "hsl(210 40% 75%)" }}>
                {tasks.length > 0
                  ? "Nenhuma tarefa órfã nos últimos 30 dias"
                  : "Aguardando dados…"}
              </p>
              <p className="text-xs" style={{ color: "hsl(215 20% 40%)" }}>
                {tasks.length > 0
                  ? "Todos os projetos estão devidamente vinculados."
                  : "Clique em Atualizar para carregar."}
              </p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={page}>
                {paginated.map((ot, idx) => (
                  <motion.div
                    key={ot.task_id || idx}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.03 * idx }}
                    className="hidden sm:grid grid-cols-[1fr_160px_110px_180px] items-center gap-2 px-5 py-3.5 transition-colors"
                    style={{
                      borderBottom: "1px solid hsl(222 25% 11%)",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(222 40% 10%)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="truncate text-sm font-medium" style={{ color: "hsl(210 40% 85%)" }}>
                        {ot.title}
                      </p>
                      {ot.projectRaw !== "—" && (
                        <p className="mt-0.5 truncate text-[10px]" style={{ color: "hsl(38 70% 50% / 0.5)" }}>
                          {ot.projectRaw}
                        </p>
                      )}
                    </div>
                    <p className="truncate text-xs" style={{ color: "hsl(215 20% 55%)" }}>
                      {ot.consultant}
                    </p>
                    <p
                      className="text-xs font-medium"
                      style={{
                        color: !ot.deadline
                          ? "hsl(215 20% 38%)"
                          : ot.deadline < new Date()
                          ? "hsl(0 70% 60%)"
                          : "hsl(215 20% 60%)",
                      }}
                    >
                      {ot.deadline ? formatDatePtBR(ot.deadline) : "—"}
                    </p>
                    <span
                      className="flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold"
                      style={{
                        background: "hsl(38 92% 50% / 0.1)",
                        boxShadow: "0 0 0 1px hsl(38 92% 50% / 0.2)",
                        color: "hsl(38 92% 60%)",
                      }}
                    >
                      <Unlink className="h-2.5 w-2.5 shrink-0" />
                      {ot.reason}
                    </span>
                  </motion.div>
                ))}
                {/* Mobile card layout */}
                {paginated.map((ot, idx) => (
                  <motion.div
                    key={`m-${ot.task_id || idx}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.03 * idx }}
                    className="sm:hidden flex flex-col gap-2 px-4 py-3.5"
                    style={{ borderBottom: "1px solid hsl(222 25% 11%)" }}
                  >
                    <p className="text-sm font-medium leading-snug" style={{ color: "hsl(210 40% 85%)" }}>
                      {ot.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: "hsl(215 20% 55%)" }}>
                      <span>{ot.consultant}</span>
                      <span
                        style={{
                          color: !ot.deadline
                            ? "hsl(215 20% 38%)"
                            : ot.deadline < new Date()
                            ? "hsl(0 70% 60%)"
                            : "hsl(215 20% 60%)",
                        }}
                      >
                        {ot.deadline ? formatDatePtBR(ot.deadline) : "Sem prazo"}
                      </span>
                    </div>
                    <span
                      className="flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold"
                      style={{
                        background: "hsl(38 92% 50% / 0.1)",
                        boxShadow: "0 0 0 1px hsl(38 92% 50% / 0.2)",
                        color: "hsl(38 92% 60%)",
                      }}
                    >
                      <Unlink className="h-2.5 w-2.5 shrink-0" />
                      {ot.reason}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </motion.div>

        {/* ── Pagination ── */}
        {orphanTasks.length > ORPHAN_PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs" style={{ color: "hsl(215 20% 45%)" }}>
              {Math.min((page - 1) * ORPHAN_PAGE_SIZE + 1, orphanTasks.length)}–
              {Math.min(page * ORPHAN_PAGE_SIZE, orphanTasks.length)} de {orphanTasks.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg transition-all hover:opacity-80 disabled:opacity-30"
                style={{
                  background: "hsl(222 40% 11%)",
                  boxShadow: "0 0 0 1px hsl(222 25% 15%)",
                  color: "hsl(215 20% 60%)",
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[60px] text-center text-xs font-medium" style={{ color: "hsl(215 20% 55%)" }}>
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-lg transition-all hover:opacity-80 disabled:opacity-30"
                style={{
                  background: "hsl(222 40% 11%)",
                  boxShadow: "0 0 0 1px hsl(222 25% 15%)",
                  color: "hsl(215 20% 60%)",
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
