import type { TaskRecord } from "./types";

const INTERNAL_PROJECT_ALIASES = ["sp", "isp", "interno", "internal"];

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isBlank(value: unknown) {
  return String(value ?? "").trim() === "";
}

export type TaskOperationalIssueCode =
  | "missing_from_source"
  | "missing_project"
  | "missing_title"
  | "missing_responsible"
  | "missing_deadline"
  | "project_archived"
  | "deleted_confirmed"
  | "not_found_or_no_access"
  | "stale_not_seen"
  | "invalid_project"
  | "internal_project";

export function getTaskOperationalIssues(task: TaskRecord): TaskOperationalIssueCode[] {
  const issues: TaskOperationalIssueCode[] = [];
  const diagnosticCodes = Array.isArray(task.diagnostic_codes)
    ? task.diagnostic_codes.filter((code): code is TaskOperationalIssueCode => typeof code === "string")
    : [];

  if (diagnosticCodes.length) return diagnosticCodes;

  const projectId = String(task.project_id ?? "").trim();
  const projectName = String(
    task.projects?.name ??
      task.project_name ??
      task.project ??
      task.group_name ??
      "",
  ).trim();
  const normalizedProjectName = normalizeText(projectName);
  const isInternalAlias =
    !projectId &&
    INTERNAL_PROJECT_ALIASES.some(
      (alias) => normalizedProjectName === alias || normalizedProjectName === `${alias} consulte`,
    );

  if (task.local_state === "project_archived" || task.project_closed === true || task.projects?.closed === true) issues.push("project_archived");
  if (task.local_state === "deleted_confirmed") issues.push("deleted_confirmed");
  if (task.local_state === "not_found_or_no_access") issues.push("not_found_or_no_access");
  if (task.local_state === "stale_not_seen") issues.push("stale_not_seen");
  if (task.missing_from_bitrix_since) issues.push("missing_from_source");
  if (!projectId || isInternalAlias) issues.push("missing_project");
  if (isBlank(task.title ?? task.nome ?? task.name)) issues.push("missing_title");
  if (isBlank(task.responsible_name ?? task.consultant ?? task.owner ?? task.responsavel)) {
    issues.push("missing_responsible");
  }
  if (!task.deadline && !task.due_date && !task.dueDate && !task.data) issues.push("missing_deadline");

  return issues;
}

export function shouldShowTaskInOperations(
  task: TaskRecord,
  visibilityMode?: string | null,
) {
  if (visibilityMode === "diagnostic_only") return false;
  return getTaskOperationalIssues(task).length === 0;
}
