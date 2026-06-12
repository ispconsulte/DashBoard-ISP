import { describe, expect, it } from "vitest";
import { taskMatchesConsultantFilter } from "./taskConsultantFilter";
import type { TaskView } from "./types";

const task = (overrides: Partial<TaskView> = {}): TaskView =>
  ({
    consultant: "Kaio Jordan Oliveira",
    raw: { responsible_id: 10, task_id: 24 },
    ...overrides,
  }) as TaskView;

describe("taskMatchesConsultantFilter", () => {
  it("matches when task responsible equals selected consultant", () => {
    expect(
      taskMatchesConsultantFilter({
        task: task({ consultant: "Raphael Morais de Jesus Schultz" }),
        selectedConsultant: "Raphael Morais de Jesus Schultz",
      }),
    ).toBe(true);
  });

  it("does not match when task responsible is a different person", () => {
    expect(
      taskMatchesConsultantFilter({
        task: task({ consultant: "Kaio Jordan Oliveira" }),
        selectedConsultant: "Raphael Morais de Jesus Schultz",
      }),
    ).toBe(false);
  });

  it("returns true for 'all'", () => {
    expect(
      taskMatchesConsultantFilter({
        task: task(),
        selectedConsultant: "all",
      }),
    ).toBe(true);
  });

  it("compares ignoring case and accents", () => {
    expect(
      taskMatchesConsultantFilter({
        task: task({ consultant: "José Silva" }),
        selectedConsultant: "jose silva",
      }),
    ).toBe(true);
  });
});
