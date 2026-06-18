import { describe, it, expect } from "vitest";
import { formatDateBR, formatDateTimeBR, BR_TIME_ZONE } from "./utils";

describe("formatDateBR / formatDateTimeBR (America/Sao_Paulo)", () => {
  it("exposes the Brazilian timezone", () => {
    expect(BR_TIME_ZONE).toBe("America/Sao_Paulo");
  });

  it("formats a UTC ISO timestamp in São Paulo time (UTC-3)", () => {
    // 2026-02-16T02:30:00Z => 23:30 do dia 15 em São Paulo
    expect(formatDateTimeBR("2026-02-16T02:30:00Z")).toBe("15/02/2026 23:30");
    expect(formatDateBR("2026-02-16T02:30:00Z")).toBe("15/02/2026");
  });

  it("keeps date-only strings stable (no timezone shift)", () => {
    expect(formatDateBR("2026-02-16")).toBe("16/02/2026");
  });

  it("handles null/undefined/invalid safely with fallback", () => {
    expect(formatDateBR(null)).toBe("—");
    expect(formatDateBR(undefined)).toBe("—");
    expect(formatDateBR("not-a-date")).toBe("—");
    expect(formatDateTimeBR(null)).toBe("—");
    expect(formatDateTimeBR("", "Sem data")).toBe("Sem data");
  });

  it("accepts Date instances", () => {
    expect(formatDateBR(new Date("2026-02-16T12:00:00Z"))).toBe("16/02/2026");
  });
});
