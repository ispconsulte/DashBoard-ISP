import type { TaskView } from "@/modules/tasks/types";

type TaskCardProps = {
  task: TaskView;
};

const DEFAULT_STATUS = {
  bg: "bg-slate-500/15",
  text: "text-slate-200",
  label: "Sem status",
} as const;

const statusColors: Partial<
  Record<TaskView["statusKey"], { bg: string; text: string; label: string }>
> = {
  done: { bg: "bg-emerald-500/15", text: "text-emerald-200", label: "Concluída" },
  overdue: { bg: "bg-rose-500/15", text: "text-rose-200", label: "Atrasada" },
  pending: { bg: "bg-amber-500/15", text: "text-amber-200", label: "Em andamento" },
  unknown: DEFAULT_STATUS,
};

export function TaskCard({ task }: TaskCardProps) {
  const status = statusColors[task.statusKey] ?? DEFAULT_STATUS;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-4 transition hover:-translate-y-0.5 hover:border-indigo-400/50 hover:shadow-[0_25px_60px_-35px_rgba(0,0,0,0.85)] focus-within:ring-2 focus-within:ring-indigo-500/50">
      <div
      className={`absolute left-0 top-0 h-full w-1 ${status.text.replace("text-", "bg-")}`}
      aria-hidden="true"
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.18em] text-indigo-300">
            {task.project || "Projeto"}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-white break-words">{task.title}</h3>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${status.bg} ${status.text}`}
        >
          {status.label}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {task.statusKey === "overdue" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-3 py-1 font-semibold text-rose-100">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-rose-300" />
            Prazo estourado
          </span>
        )}
        {task.deadlineIsSoon && task.statusKey !== "overdue" && task.statusKey !== "done" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1 font-semibold text-amber-100">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-300" />
            Prazo chegando
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-300">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2">
          <p className="text-xs text-slate-500">Consultor</p>
          <p className="font-semibold text-white">{task.consultant || "—"}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2">
          <p className="text-xs text-slate-500">Tempo total</p>
          <p className="font-semibold text-white">{task.durationLabel}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2">
          <p className="text-xs text-slate-500">Prazo</p>
          <p className={`font-semibold ${task.deadlineColor}`}>{task.deadlineLabel}</p>
        </div>
        {task.userId && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2">
            <p className="text-xs text-slate-500">User ID</p>
            <p className="font-semibold text-slate-200">{task.userId}</p>
          </div>
        )}
      </div>
    </div>
  );
}
