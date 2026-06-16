import type { TaskRecord, TaskView } from "./types";
import {
  deadlineColor,
  formatDatePtBR,
  formatDurationHHMM,
  getTaskDurationSeconds,
  getTaskTimeSpentSeconds,
  isDeadlineSoon,
  normalizeTaskTitle,
  parseDateValue,
  type TaskStatusKey,
} from "./utils";

/**
 * Constrói um {@link TaskView} a partir de um {@link TaskRecord} bruto, com a
 * MESMA lógica de status/horas/prazo usada na tela de Tarefas. Centraliza a
 * normalização para que a lista de atividades do cliente (TaskListTable) reúse
 * exatamente as mesmas colunas e formatação, sem duplicar a lógica.
 */

const pickField = (task: TaskRecord, keys: string[], fallback = ""): string => {
  for (const key of keys) {
    const v = task[key];
    if (v) return String(v);
  }
  return fallback;
};

const normalizeComparable = (value?: string | null) =>
  String(value ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

const isCompletedStatus = (value: string | number | undefined) =>
  ["done", "concluido", "completed", "finalizado", "finalizada"].includes(normalizeComparable(String(value ?? "")));

const mapStatusKey = (statusRaw: string | number | undefined, deadline: Date | null): TaskStatusKey => {
  if (statusRaw === undefined || statusRaw === null) return "unknown";
  const asNumber = typeof statusRaw === "number" ? statusRaw : Number(statusRaw);
  if (!Number.isNaN(asNumber)) {
    if (asNumber === 5) return "done";
    if (deadline && deadline < new Date()) return "overdue";
    if ([2, 3, 4, 6].includes(asNumber)) return "pending";
  }
  const asString = String(statusRaw).toLowerCase();
  if (isCompletedStatus(asString)) return "done";
  if (deadline && deadline < new Date()) return "overdue";
  if (["em andamento", "in progress", "pendente", "pending"].includes(asString)) return "pending";
  return "unknown";
};

export function taskViewFromRecord(
  task: TaskRecord,
  elapsedSeconds?: number,
  projectNameById?: Map<string, string>,
): TaskView {
  const title = normalizeTaskTitle(pickField(task, ["title", "nome", "name"], "Tarefa sem título"));
  const projectId = pickField(task, ["project_id", "projectId"], "").trim();
  const projectFromJoin =
    task.projects && typeof task.projects === "object"
      ? pickField(task.projects as TaskRecord, ["name"], "")
      : "";
  const projectFromMap = projectId && projectNameById ? (projectNameById.get(projectId) ?? "") : "";
  const project =
    projectFromJoin ||
    projectFromMap ||
    pickField(task, ["project", "projeto", "project_name", "group_name", "group"], "") ||
    (projectId ? `Projeto #${projectId}` : "Projeto indefinido");
  const consultant = pickField(task, ["responsible_name", "consultant", "owner", "responsavel"], "Sem consultor");
  const description = pickField(task, ["description", "descricao"], "Sem descrição");
  const statusRaw = pickField(task, ["status", "situacao", "estado"], "").toLowerCase();
  const deadline =
    parseDateValue(task["due_date"]) ||
    parseDateValue(task["dueDate"]) ||
    parseDateValue(task["deadline"]) ||
    parseDateValue(task["data"]);
  const statusKey = mapStatusKey(statusRaw, deadline);
  const isDone = statusKey === "done";
  const isOverdue = statusKey === "overdue" || (!isDone && deadline !== null && deadline < new Date());
  const deadlineIsSoon = !isDone && !isOverdue && isDeadlineSoon(deadline, new Date());
  const timeSpentSeconds = getTaskTimeSpentSeconds(task as Record<string, unknown>);
  const seconds = getTaskDurationSeconds(task, elapsedSeconds);
  const diffSeconds =
    typeof timeSpentSeconds === "number" && typeof elapsedSeconds === "number"
      ? Math.round(timeSpentSeconds - elapsedSeconds)
      : undefined;
  const hasHourMismatch = typeof diffSeconds === "number" && Math.abs(diffSeconds) >= 60;

  return {
    title,
    description,
    project,
    consultant,
    statusKey,
    durationSeconds: seconds,
    durationLabel: formatDurationHHMM(seconds),
    elapsedSeconds,
    durationDiffSeconds: diffSeconds,
    hasHourMismatch,
    deadlineDate: deadline,
    deadlineLabel: formatDatePtBR(deadline),
    deadlineColor: deadlineColor(statusKey, isOverdue),
    deadlineIsSoon,
    userId: task["user_id"] ?? null,
    raw: task,
  };
}
