import { describe, expect, it } from "vitest";
import {
  TASKS_PAGE_ELAPSED_STATE_FILTER,
  TASKS_PAGE_TASK_STATE_FILTER,
  isTasksPageElapsedState,
} from "./taskOperationalFilters";

describe("task operational filters", () => {
  it("keeps active tasks visible even when they have integrity diagnostics", () => {
    expect(TASKS_PAGE_TASK_STATE_FILTER).toBe("local_state=eq.active");
  });

  it("includes time entries blocked only by task integrity so elapsed-date filters still find the task", () => {
    expect(TASKS_PAGE_ELAPSED_STATE_FILTER).toBe("local_state=in.(active,task_integrity_blocked)");
    expect(isTasksPageElapsedState("active")).toBe(true);
    expect(isTasksPageElapsedState("task_integrity_blocked")).toBe(true);
    expect(isTasksPageElapsedState("not_found_or_no_access")).toBe(false);
  });
});
