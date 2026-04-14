import { SUPABASE_URL } from "@/lib/supabase";

const EDGE_FN_URL = `${SUPABASE_URL}/functions/v1/admin-diagnostics`;

type VisibilityMode = "diagnostic_only" | "show_in_operations";
type ReviewStatus = "pending" | "reviewing" | "resolved" | "ignored";

export type IntegrityProblem = {
  code: string;
  label: string;
  meaning: string;
  severity: number;
};

export type IntegrityTaskItem = {
  task_id: number;
  title: string;
  status: string | number | null;
  responsible_name: string | null;
  deadline: string | null;
  closed_date: string | null;
  project_id: number | null;
  project_name: string | null;
  inserted_at: string | null;
  updated_at: string | null;
  last_seen_in_bitrix_at: string | null;
  missing_from_bitrix_since: string | null;
  problems: IntegrityProblem[];
  severity: number;
  visibility_mode: VisibilityMode;
  review_status: ReviewStatus;
  admin_note: string | null;
  control_updated_at: string | null;
};

export type IntegrityElapsedItem = {
  id: number;
  task_id: number | null;
  bitrix_task_id_raw: number | null;
  orphan_reason: string | null;
  orphan_detected_at: string | null;
  created_date: string | null;
  date_start: string | null;
  date_stop: string | null;
  updated_at: string | null;
  minutes: number;
  seconds: number;
  comment_text: string | null;
  label: string;
  meaning: string;
  related_task_name: string | null;
  related_task_status: string | number | null;
  related_task_responsible: string | null;
  visibility_mode: VisibilityMode;
  review_status: ReviewStatus;
  admin_note: string | null;
  control_updated_at: string | null;
};

export type IntegrityRun = {
  job_name: string;
  status: string;
  triggered_by: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
  details?: Record<string, unknown> | null;
};

export type IntegrityConfig = {
  job_name: string;
  cron_expression: string;
  enabled: boolean;
  last_scheduled_at: string | null;
  last_job_id: number | null;
  updated_at: string | null;
};

export type IntegrityPayload = {
  overview: {
    total_tasks: number;
    problematic_tasks: number;
    projectless_tasks: number;
    missing_from_source_tasks: number;
    incomplete_tasks: number;
    hidden_from_operations: number;
    orphan_elapsed_entries: number;
  };
  sync: {
    configs: IntegrityConfig[];
    latest_tasks_run: IntegrityRun | null;
    latest_times_run: IntegrityRun | null;
    recent_runs: IntegrityRun[];
  };
  problematic_tasks: IntegrityTaskItem[];
  orphan_elapsed: IntegrityElapsedItem[];
};

async function request<T>(token: string, body?: Record<string, unknown>, timeoutMs = 40000): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(EDGE_FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body ?? { action: "list" }),
      signal: controller.signal,
    });

    const json = await response.json().catch(() => null);
    if (!response.ok || json?.ok === false) {
      throw new Error(json?.error ?? `HTTP ${response.status}`);
    }
    return json.data as T;
  } finally {
    window.clearTimeout(timer);
  }
}

export function fetchIntegrityDashboard(token: string) {
  return request<IntegrityPayload>(token, { action: "list" });
}

export function upsertIntegrityTaskControl(
  token: string,
  payload: {
    task_id: number;
    visibility_mode: VisibilityMode;
    review_status: ReviewStatus;
    admin_note?: string | null;
  },
) {
  return request<IntegrityPayload>(token, {
    action: "upsert_task_control",
    ...payload,
  });
}

export function upsertIntegrityElapsedControl(
  token: string,
  payload: {
    elapsed_id: number;
    visibility_mode: VisibilityMode;
    review_status: ReviewStatus;
    admin_note?: string | null;
  },
) {
  return request<IntegrityPayload>(token, {
    action: "upsert_elapsed_control",
    ...payload,
  });
}

export function deleteIntegrityTask(token: string, taskId: number) {
  return request<IntegrityPayload>(token, {
    action: "delete_task",
    task_id: taskId,
  });
}

export function deleteIntegrityElapsed(token: string, elapsedId: number) {
  return request<IntegrityPayload>(token, {
    action: "delete_elapsed",
    elapsed_id: elapsedId,
  });
}
