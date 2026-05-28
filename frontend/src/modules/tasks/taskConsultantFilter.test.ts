import { describe, expect, it } from "vitest";
import { taskMatchesConsultantFilter } from "./taskConsultantFilter";
import type { ElapsedTimeRecord, TaskView } from "./types";

const task = (overrides: Partial<TaskView> = {}): TaskView =>
  ({
    consultant: "Kaio Jordan Oliveira",
    raw: { responsible_id: 10, task_id: 24 },
    ...overrides,
  }) as TaskView;

describe("taskMatchesConsultantFilter", () => {
  it("matches the selected consultant by task responsible", () => {
    expect(
      taskMatchesConsultantFilter({
        task: task({ consultant: "Raphael Morais de Jesus Schultz" }),
        selectedConsultant: "Raphael Morais de Jesus Schultz",
      }),
    ).toBe(true);
  });

  it("matches the selected consultant by elapsed time author even when task responsible is another user", () => {
    const entries: ElapsedTimeRecord[] = [{ task_id: 24, user_id: 8, seconds: 547200 }];

    expect(
      taskMatchesConsultantFilter({
        task: task(),
        selectedConsultant: "Raphael Morais de Jesus Schultz",
        entries,
        userNames: { "8": "Raphael Morais de Jesus Schultz" },
      }),
    ).toBe(true);
  });
});
