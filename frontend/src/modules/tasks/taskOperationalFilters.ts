export const TASKS_PAGE_TASK_STATE_FILTER = "local_state=eq.active";

export const TASKS_PAGE_ELAPSED_STATES = ["active", "task_integrity_blocked"] as const;

export const TASKS_PAGE_ELAPSED_STATE_FILTER = `local_state=in.(${TASKS_PAGE_ELAPSED_STATES.join(",")})`;

export function isTasksPageElapsedState(value: unknown) {
  return TASKS_PAGE_ELAPSED_STATES.includes(value as (typeof TASKS_PAGE_ELAPSED_STATES)[number]);
}
