export type TaskStatusKey = "done" | "pending" | "overdue" | "unknown";

export const DEFAULT_DEADLINE_SOON_DAYS = 3;

/**
 * Timezone canônica para exibição ao usuário (Brasil).
 * Todos os timestamps vindos de APIs (UTC/ISO) devem ser formatados nela,
 * para não exibir hora deslocada conforme o fuso do navegador.
 */
export const BR_TIME_ZONE = "America/Sao_Paulo";

/** Converte valor cru (string ISO/UTC, Date ou epoch) em Date válido ou null. */
const toValidDate = (value?: string | number | Date | null): Date | null => {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Formata data como dd/MM/yyyy no fuso de São Paulo. Trata null/invalid.
 * Para strings date-only "YYYY-MM-DD" mantém o dia exato (sem shift de fuso).
 */
export const formatDateBR = (
  value?: string | number | Date | null,
  fallback = "—"
): string => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}/${m}/${y}`;
  }
  const date = toValidDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: BR_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

/** Formata data/hora como dd/MM/yyyy HH:mm no fuso de São Paulo. Trata null/invalid. */
export const formatDateTimeBR = (
  value?: string | number | Date | null,
  fallback = "—"
): string => {
  const date = toValidDate(value);
  if (!date) return fallback;
  // Monta explicitamente "dd/MM/yyyy HH:mm" para evitar a vírgula que o
  // Intl insere entre data e hora em pt-BR.
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: BR_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
};

/**
 * Returns today's date as "YYYY-MM-DD" in the user's local timezone.
 * Avoids the UTC offset bug from `new Date().toISOString().slice(0,10)`.
 */
export const todayLocalIso = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

/**
 * Converts a Date object to "YYYY-MM-DD" using local timezone.
 * Avoids the UTC offset bug from `.toISOString().slice(0,10)`.
 */
export const dateToLocalIso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const parseLocalDateInput = (value?: string | null, endOfDay = false): Date | null => {
  if (!value) return null;
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, year, month, day] = match;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (endOfDay) date.setHours(23, 59, 59, 999);
    else date.setHours(0, 0, 0, 0);
    return date;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  if (endOfDay) parsed.setHours(23, 59, 59, 999);
  return parsed;
};

/**
 * Formats an ISO date string "YYYY-MM-DD" to "DD/MM" or "DD/MM/YYYY"
 * by parsing the string directly (no Date constructor = no timezone shift).
 */
export const formatIsoToPtBr = (iso: string, includeYear = false): string => {
  const parts = String(iso).split("-");
  if (parts.length < 3) return iso;
  return includeYear ? `${parts[2]}/${parts[1]}/${parts[0]}` : `${parts[2]}/${parts[1]}`;
};

/**
 * Safely formats a date-only ISO string or timestamp for display.
 * Uses toLocaleDateString only on full timestamps (with time), avoiding
 * the off-by-one bug that occurs with date-only strings like "2026-02-16".
 */
export const formatTimestampPtBr = (
  raw: string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string => {
  if (!raw) return "—";
  // If it's a date-only string (YYYY-MM-DD), parse directly
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-");
    const defaults = options ?? { day: "2-digit", month: "short" };
    // Create at noon local to avoid any shift
    return new Date(Number(y), Number(m) - 1, Number(d), 12).toLocaleDateString("pt-BR", defaults);
  }
  // Full timestamp — format in the Brazilian timezone so UTC strings don't shift
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", {
    timeZone: BR_TIME_ZONE,
    ...(options ?? { day: "2-digit", month: "short" }),
  });
};

export const parseDateValue = (value?: unknown): Date | null => {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * Data canônica da tarefa para filtro de período, alinhada ao relatório
 * "Horas trabalhadas por projetos" do Bitrix, que filtra por CHANGED_DATE
 * (data da última modificação). Fallbacks cobrem tarefas sem changed_date.
 */
export const getTaskPeriodDate = (task: Record<string, unknown>): Date | null =>
  parseDateValue(task["changed_date"]) ||
  parseDateValue(task["closed_date"]) ||
  parseDateValue(task["deadline"]) ||
  parseDateValue(task["created_date"]) ||
  parseDateValue(task["created_at"]);

export const collectTaskRelevantDates = (task: Record<string, unknown>): Date[] => {
  const candidates = [
    task["deadline"],
    task["due_date"],
    task["dueDate"],
    task["closed_date"],
    task["changed_date"],
    task["created_date"],
    task["created_at"],
    task["createdAt"],
  ];

  return candidates
    .map((value) => parseDateValue(value))
    .filter((value): value is Date => value instanceof Date);
};

export const getElapsedEffectiveDate = (value: {
  reference_date?: unknown;
  date_start?: unknown;
  created_date?: unknown;
  inserted_at?: unknown;
  updated_at?: unknown;
}) =>
  parseDateValue(value.reference_date) ||
  parseDateValue(value.date_start) ||
  parseDateValue(value.created_date) ||
  parseDateValue(value.inserted_at) ||
  parseDateValue(value.updated_at);

export const formatDatePtBR = (value: Date | null) => {
  if (!value) return "Sem prazo";
  return value.toLocaleDateString("pt-BR", { timeZone: BR_TIME_ZONE });
};

export const formatDurationHHMM = (seconds?: number) => {
  if (seconds === undefined || seconds === null || Number.isNaN(seconds)) return "";

  const safeSeconds = Math.max(0, Math.floor(seconds));
  if (safeSeconds === 0) return "";

  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;
  const parts: string[] = [];

  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${String(minutes).padStart(2, "0")}m`);
  if (remainingSeconds > 0) parts.push(`${String(remainingSeconds).padStart(2, "0")}s`);

  return parts.join(" ") || "0s";
};

const parseNumericValue = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const firstPositiveNumber = (record: Record<string, unknown>, keys: string[]): number | null => {
  for (const key of keys) {
    const parsed = parseNumericValue(record[key]);
    if (parsed != null && parsed > 0) return parsed;
  }
  return null;
};

export const getTaskTimeSpentSeconds = (task: Record<string, unknown>): number | null =>
  firstPositiveNumber(task, ["time_spent_in_logs", "timeSpentInLogs", "TIME_SPENT_IN_LOGS"]);

export const getTaskDurationSeconds = (
  task: Record<string, unknown>,
  elapsedFallbackSeconds?: number | null,
): number | undefined => {
  if (typeof elapsedFallbackSeconds === "number" && Number.isFinite(elapsedFallbackSeconds) && elapsedFallbackSeconds > 0) {
    return elapsedFallbackSeconds;
  }

  const bitrixSeconds = getTaskTimeSpentSeconds(task);
  if (bitrixSeconds != null) return bitrixSeconds;

  const explicitSeconds = firstPositiveNumber(task, ["duration_seconds", "durationSeconds", "seconds"]);
  if (explicitSeconds != null) return explicitSeconds;

  const minutes = firstPositiveNumber(task, ["duration_minutes", "duration", "tempo_total", "minutes"]);
  return minutes != null ? minutes * 60 : undefined;
};

/**
 * Formats a decimal hours value into a human-readable string.
 * Examples: 0.5 → "30min", 1.33 → "1h 20min", 2 → "2h", 0.016 → "1min"
 * Designed to be unambiguous for non-technical users.
 */
export const formatHoursHuman = (hours: number): string => {
  if (!hours || !Number.isFinite(hours) || hours <= 0) return "0min";
  const totalMinutes = Math.round(hours * 60);
  if (totalMinutes < 1) return "<1min";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${String(m).padStart(2, "0")}min`;
};

/**
 * Formats seconds into a human-readable label for KPI cards and summaries.
 * Examples: 3600 → "1h", 5400 → "1h 30min", 2400 → "40min"
 */
export const formatSecondsHuman = (seconds: number): string => {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return "0min";
  return formatHoursHuman(seconds / 3600);
};

/**
 * Returns a color class based on duration range.
 * Green: < 1h, Yellow: 1-4h, Red: > 4h
 */
export const durationColorClass = (seconds?: number): { text: string; bg: string; border: string; accent: string } => {
  if (!seconds || seconds <= 0) return { text: "text-[hsl(var(--task-text-muted))]", bg: "bg-[hsl(var(--task-surface))]", border: "border-[hsl(var(--task-border))]", accent: "hsl(var(--task-text-muted))" };
  const hours = seconds / 3600;
  if (hours < 1) return { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", accent: "hsl(160 84% 39%)" };
  if (hours <= 4) return { text: "text-[hsl(var(--task-yellow))]", bg: "bg-[hsl(var(--task-yellow)/0.1)]", border: "border-[hsl(var(--task-yellow)/0.2)]", accent: "hsl(var(--task-yellow))" };
  return { text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20", accent: "hsl(0 84% 60%)" };
};

export const normalizeTaskTitle = (value?: string) => {
  if (!value) return "";
  const cleaned = value
    .replace(/^[\s\u2500-\u257F\u2502\u2514\u251C\u2510\u2518\u250C\u2570\u2571\u2572\u2573\-–—•·]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned || value.trim();
};

export const isDeadlineSoon = (
  deadline: Date | null,
  now: Date,
  daysThreshold = DEFAULT_DEADLINE_SOON_DAYS
) => {
  if (!deadline) return false;
  const diff = deadline.getTime() - now.getTime();
  const thresholdMs = daysThreshold * 24 * 60 * 60 * 1000;
  return diff > 0 && diff <= thresholdMs;
};

export const deadlineColor = (status: TaskStatusKey, isOverdue: boolean) => {
  if (status === "done") return "text-emerald-200";
  if (isOverdue) return "text-rose-200";
  return "text-slate-200";
};

const plural = (value: number, singular: string, pluralText: string) =>
  value === 1 ? singular : pluralText;

export const formatDeadlineRelative = (deadline: Date | null, now: Date) => {
  if (!deadline) return "Sem prazo";
  const diffMs = deadline.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return "Hoje";
  if (diffDays > 0) {
    if (diffDays === 1) return "Amanha";
    if (diffDays < 7) return `${diffDays} dias`;
    const weeks = Math.round(diffDays / 7);
    if (diffDays < 30) return `${weeks} ${plural(weeks, "semana", "semanas")}`;
    const months = Math.round(diffDays / 30);
    return `${months} ${plural(months, "mes", "meses")}`;
  }

  const absDays = Math.abs(diffDays);
  if (absDays === 1) return "Ontem";
  if (absDays < 7) return `- ${absDays} dias`;
  const weeks = Math.round(absDays / 7);
  if (absDays < 30) return `- ${weeks} ${plural(weeks, "semana", "semanas")}`;
  const months = Math.round(absDays / 30);
  return `- ${months} ${plural(months, "mes", "meses")}`;
};
