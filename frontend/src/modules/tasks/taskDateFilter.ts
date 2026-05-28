import { parseLocalDateInput } from "./utils";
import type { TaskView } from "./types";

export type TaskDateFilterMode = "closed_date" | "created_date" | "deadline" | "elapsed_created_date";

export const DEFAULT_TASK_DATE_FILTER_MODE: TaskDateFilterMode = "elapsed_created_date";

export const isTaskDateFilterMode = (value: unknown): value is TaskDateFilterMode =>
  value === "closed_date" ||
  value === "created_date" ||
  value === "deadline" ||
  value === "elapsed_created_date";

export const taskDateFilterOptions: Array<{ value: TaskDateFilterMode; label: string }> = [
  { value: "elapsed_created_date", label: "Data e tempo gasto" },
  { value: "closed_date", label: "Data de fechamento" },
  { value: "created_date", label: "Data de criação" },
  { value: "deadline", label: "Data de prazo" },
];

const TASK_DATE_COLUMNS: Record<Exclude<TaskDateFilterMode, "elapsed_created_date">, string> = {
  closed_date: "closed_date",
  created_date: "created_date",
  deadline: "deadline",
};

const periodDays = (period?: string) =>
  period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : period === "180d" ? 180 : null;

export function getTaskDateRange(period?: string, dateFrom?: string, dateTo?: string, now = new Date()) {
  if (!period || period === "all") return { from: null as Date | null, to: null as Date | null };

  if (period === "custom") {
    return {
      from: dateFrom ? parseLocalDateInput(dateFrom) : null,
      to: dateTo ? parseLocalDateInput(dateTo, true) : null,
    };
  }

  const days = periodDays(period);
  if (!days) return { from: null as Date | null, to: null as Date | null };
  return {
    from: new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
    to: null as Date | null,
  };
}

const buildColumnDateFilter = (column: string, period?: string, dateFrom?: string, dateTo?: string, now = new Date()) => {
  const { from, to } = getTaskDateRange(period, dateFrom, dateTo, now);
  const parts: string[] = [];
  if (from && !Number.isNaN(from.getTime())) parts.push(`${column}=gte.${encodeURIComponent(from.toISOString())}`);
  if (to && !Number.isNaN(to.getTime())) parts.push(`${column}=lte.${encodeURIComponent(to.toISOString())}`);
  return parts.join("&");
};

export function buildTaskDateFilter(
  mode: TaskDateFilterMode,
  period?: string,
  dateFrom?: string,
  dateTo?: string,
  now = new Date(),
) {
  if (mode === "elapsed_created_date") return "";
  return buildColumnDateFilter(TASK_DATE_COLUMNS[mode], period, dateFrom, dateTo, now);
}

export function buildElapsedCreatedDateFilter(period?: string, dateFrom?: string, dateTo?: string, now = new Date()) {
  return buildColumnDateFilter("created_date", period, dateFrom, dateTo, now);
}

export function taskMatchesStatus(task: TaskView, status: string) {
  if (status === "all") return true;
  if (status === "done") return task.statusKey === "done";
  if (status === "overdue") return task.statusKey === "overdue";
  return task.statusKey === "pending" || task.statusKey === "unknown";
}
