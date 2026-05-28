import { getTaskTimeSpentSeconds } from "@/modules/tasks/utils";
import type { ProjectHours, TaskHoursMismatch } from "./useProjectHours";

export type ProjectHoursElapsedRow = {
  task_id: string | number | null;
  user_id?: string | number | null;
  seconds: string | number | null;
  reference_date?: string | null;
  date_start?: string | null;
  created_date?: string | null;
};

export type ProjectHoursTaskRow = {
  task_id: string | number;
  title?: string | null;
  responsible_name?: string | null;
  project_id: string | number | null;
  group_name: string | null;
  time_spent_in_logs?: string | number | null;
  changed_date?: string | null;
  projects?: {
    name?: string | null;
    cliente_id?: string | number | null;
  } | null;
};

type BuildProjectHoursParams = {
  elapsedRows: ProjectHoursElapsedRow[];
  taskRows: ProjectHoursTaskRow[];
  clientNameById: Map<number, string>;
  startIso: string;
  endIso: string;
  clientId?: number | null;
  projectId?: number | null;
  userId?: number | null;
};

const toFiniteNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const effectiveReferenceDate = (row: ProjectHoursElapsedRow): Date | null => {
  const value = row.reference_date ?? row.date_start ?? row.created_date ?? null;
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export function buildProjectHoursFromElapsedRows(params: BuildProjectHoursParams): {
  data: ProjectHours[];
  mismatches: TaskHoursMismatch[];
} {
  const start = new Date(params.startIso);
  const end = new Date(params.endIso);
  const taskById = new Map(params.taskRows.map((row) => [String(row.task_id), row]));
  const elapsedByTaskId = new Map<string, number>();
  const totals = new Map<number, ProjectHours>();

  for (const elapsed of params.elapsedRows) {
    const taskId = elapsed.task_id == null ? "" : String(elapsed.task_id);
    if (!taskId) continue;
    if (params.userId && Number(elapsed.user_id ?? 0) !== params.userId) continue;

    const effectiveDate = effectiveReferenceDate(elapsed);
    if (!effectiveDate || effectiveDate < start || effectiveDate > end) continue;

    const task = taskById.get(taskId);
    if (!task) continue;

    const resolvedProjectId = Number(task.project_id ?? 0);
    if (!resolvedProjectId || (params.projectId && resolvedProjectId !== params.projectId)) continue;

    const resolvedClientId = Number(task.projects?.cliente_id ?? 0);
    if (params.clientId && resolvedClientId !== params.clientId) continue;

    const seconds = toFiniteNumber(elapsed.seconds);
    if (seconds <= 0) continue;

    elapsedByTaskId.set(taskId, (elapsedByTaskId.get(taskId) ?? 0) + seconds);

    const current = totals.get(resolvedProjectId) ?? {
      projectId: resolvedProjectId,
      projectName: String(task.projects?.name ?? task.group_name ?? `Projeto #${resolvedProjectId}`),
      clientId: resolvedClientId,
      clientName: resolvedClientId ? params.clientNameById.get(resolvedClientId) ?? "" : "",
      hours: 0,
      seconds: 0,
      elapsedSeconds: 0,
      diffSeconds: 0,
      hasHourMismatch: false,
    };

    current.seconds += seconds;
    current.elapsedSeconds = current.seconds;
    current.hours = Math.round((current.seconds / 3600) * 100) / 100;
    if (!current.clientName && resolvedClientId) {
      current.clientName = params.clientNameById.get(resolvedClientId) ?? "";
    }
    totals.set(resolvedProjectId, current);
  }

  const mismatches = params.taskRows
    .map((task) => {
      const taskId = String(task.task_id ?? "");
      if (!elapsedByTaskId.has(taskId)) return null;
      const elapsedSeconds = Math.round(elapsedByTaskId.get(taskId) ?? 0);
      const timeSpentSeconds = Math.round(getTaskTimeSpentSeconds(task as unknown as Record<string, unknown>) ?? 0);
      const diffSeconds = timeSpentSeconds - elapsedSeconds;
      if (timeSpentSeconds === 0 && elapsedSeconds === 0) return null;
      if (Math.abs(diffSeconds) < 60) return null;

      const resolvedProjectId = Number(task.project_id ?? 0);
      return {
        taskId,
        title: String(task.title ?? `Tarefa #${taskId}`),
        projectId: resolvedProjectId,
        projectName: String(task.projects?.name ?? task.group_name ?? `Projeto #${resolvedProjectId}`),
        responsibleName: String(task.responsible_name ?? ""),
        timeSpentSeconds,
        elapsedSeconds,
        diffSeconds,
      };
    })
    .filter((value): value is TaskHoursMismatch => value != null)
    .sort((a, b) => Math.abs(b.diffSeconds) - Math.abs(a.diffSeconds));

  const data = Array.from(totals.values())
    .map((item) => ({
      ...item,
      seconds: Math.round(item.seconds),
      elapsedSeconds: Math.round(item.elapsedSeconds),
      diffSeconds: 0,
      hasHourMismatch: false,
    }))
    .sort((a, b) => b.seconds - a.seconds);

  return { data, mismatches };
}
