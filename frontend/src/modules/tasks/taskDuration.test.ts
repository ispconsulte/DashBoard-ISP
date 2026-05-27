import { describe, expect, it } from "vitest";
import { getElapsedEffectiveDate, getTaskDurationSeconds } from "./utils";

describe("getTaskDurationSeconds", () => {
  it("prioriza os apontamentos filtrados quando elapsedFallbackSeconds existe", () => {
    expect(getTaskDurationSeconds({ time_spent_in_logs: 999999 }, 1800)).toBe(1800);
  });

  it("usa time_spent_in_logs apenas quando nao ha apontamento filtrado", () => {
    expect(getTaskDurationSeconds({ time_spent_in_logs: 3600 })).toBe(3600);
  });
});

describe("getElapsedEffectiveDate", () => {
  it("prioriza reference_date como data oficial do apontamento", () => {
    expect(
      getElapsedEffectiveDate({
        reference_date: "2026-05-10T12:00:00.000Z",
        date_start: "2026-05-11T12:00:00.000Z",
        created_date: "2026-05-12T12:00:00.000Z",
      })?.toISOString(),
    ).toBe("2026-05-10T12:00:00.000Z");
  });
});
