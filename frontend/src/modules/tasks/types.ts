import type { TaskStatusKey } from "./utils";

export type TaskRecord = {
  id?: string | number;
  task_id?: string | number;
  title?: string;
  nome?: string;
  name?: string;
  project_id?: string | number | null;
  project?: string;
  projeto?: string;
  project_name?: string;
  group_name?: string;
  local_state?: string | null;
  project_closed?: boolean | null;
  diagnostic_codes?: string[] | null;
  responsible_name?: string;
  consultant?: string;
  owner?: string;
  responsavel?: string;
  description?: string;
  descricao?: string;
  status?: string | number;
  situacao?: string | number;
  estado?: string | number;
  due_date?: string | Date | null;
  dueDate?: string | Date | null;
  deadline?: string | Date | null;
  data?: string | Date | null;
  projects?: { name?: string; cliente_id?: number | string | null; closed?: boolean | null } | null;
  duration_minutes?: number;
  duration?: number;
  tempo_total?: number;
  minutes?: number;
  created_at?: string | Date | null;
  createdAt?: string | Date | null;
  user_id?: string | number | null;
  [key: string]: unknown;
};

export type ElapsedTimeRecord = {
  id?: string | number;
  task_id?: string | number;
  bitrix_task_id_raw?: string | number | null;
  orphan_reason?: string | null;
  orphan_detected_at?: string | Date | null;
  seconds?: number;
  user_id?: string | number | null;
  date_start?: string | Date | null;
  date_stop?: string | Date | null;
  created_date?: string | Date | null;
  updated_at?: string | Date | null;
  inserted_at?: string | Date | null;
  [key: string]: unknown;
};

export type TaskStatusLabel = {
  key: TaskStatusKey;
  label: string;
};

export const STATUS_LABELS: Record<TaskStatusKey, TaskStatusLabel> = {
  overdue: { key: "overdue", label: "Atrasado" },
  pending: { key: "pending", label: "Em andamento" },
  done: { key: "done", label: "Concluído" },
  unknown: { key: "unknown", label: "Sem status" },
};

export type TaskView = {
  title: string;
  description: string;
  project: string;
  consultant: string;
  statusKey: TaskStatusKey;
  durationSeconds?: number;
  durationLabel: string;
  deadlineDate: Date | null;
  deadlineLabel: string;
  deadlineColor: string;
  deadlineIsSoon: boolean;
  userId?: string | number | null;
  raw: TaskRecord;
};
