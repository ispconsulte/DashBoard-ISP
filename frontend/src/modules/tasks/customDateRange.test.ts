import { describe, expect, it } from "vitest";
import { getCustomDateCommit, isCompleteCustomDate } from "./customDateRange";

describe("custom date range filters", () => {
  it("does not commit incomplete date input", () => {
    expect(isCompleteCustomDate("2026-05-")).toBe(false);
    expect(getCustomDateCommit("from", "2026-05-", "", "")).toEqual({});
  });

  it("does not commit dates with placeholder years produced while typing", () => {
    expect(isCompleteCustomDate("0002-05-25")).toBe(false);
    expect(getCustomDateCommit("to", "0002-05-25", "2026-05-01", "")).toEqual({});
  });

  it("does not allow the end date before the start date", () => {
    expect(getCustomDateCommit("to", "2026-04-30", "2026-05-01", "")).toEqual({});
  });

  it("clears an existing end date when the new start date passes it", () => {
    expect(getCustomDateCommit("from", "2026-05-20", "", "2026-05-10")).toEqual({
      dateFrom: "2026-05-20",
      dateTo: "",
    });
  });
});
