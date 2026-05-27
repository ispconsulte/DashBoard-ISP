import { describe, expect, it } from "vitest";
import {
  buildElapsedCreatedDateFilter,
  buildTaskDateFilter,
  getTaskDateRange,
  taskMatchesStatus,
} from "./taskDateFilter";
import type { TaskView } from "./types";

describe("buildTaskDateFilter", () => {
  const now = new Date("2026-05-27T12:00:00.000Z");

  it("gera filtro por closed_date", () => {
    expect(buildTaskDateFilter("closed_date", "custom", "2026-05-01", "2026-05-31", now)).toBe(
      "closed_date=gte.2026-05-01T03%3A00%3A00.000Z&closed_date=lte.2026-06-01T02%3A59%3A59.999Z",
    );
  });

  it("gera filtro por created_date", () => {
    expect(buildTaskDateFilter("created_date", "7d", "", "", now)).toBe(
      "created_date=gte.2026-05-20T12%3A00%3A00.000Z",
    );
  });

  it("gera filtro por deadline", () => {
    expect(buildTaskDateFilter("deadline", "30d", "", "", now)).toBe(
      "deadline=gte.2026-04-27T12%3A00%3A00.000Z",
    );
  });

  it("nao usa campo de tarefa no modo tempo gasto", () => {
    expect(buildTaskDateFilter("elapsed_created_date", "30d", "", "", now)).toBe("");
  });
});

describe("buildElapsedCreatedDateFilter", () => {
  const now = new Date("2026-05-27T12:00:00.000Z");

  it("usa created_date de elapsed_times para modo tempo gasto", () => {
    expect(buildElapsedCreatedDateFilter("custom", "2026-05-01", "2026-05-31", now)).toBe(
      "created_date=gte.2026-05-01T03%3A00%3A00.000Z&created_date=lte.2026-06-01T02%3A59%3A59.999Z",
    );
  });
});

describe("getTaskDateRange", () => {
  it("calcula intervalo personalizado completo", () => {
    const range = getTaskDateRange("custom", "2026-05-01", "2026-05-31", new Date("2026-05-27T12:00:00.000Z"));
    expect(range.from?.toISOString()).toBe("2026-05-01T03:00:00.000Z");
    expect(range.to?.toISOString()).toBe("2026-06-01T02:59:59.999Z");
  });
});

describe("taskMatchesStatus", () => {
  const task = (statusKey: TaskView["statusKey"]) => ({ statusKey }) as TaskView;

  it("aplica status depois do filtro por tempo gasto", () => {
    expect(taskMatchesStatus(task("done"), "done")).toBe(true);
    expect(taskMatchesStatus(task("pending"), "done")).toBe(false);
    expect(taskMatchesStatus(task("unknown"), "pending")).toBe(true);
  });
});
