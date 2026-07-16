import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BirthdayTaskRequestError,
  createBirthdayTask,
  type BirthdayPerson,
} from "./api/useBirthdays";

const person: BirthdayPerson = {
  bitrixUserId: "123",
  name: "Colaborador Teste",
  month: 8,
  day: 10,
  year: 2000,
  birthDate: "2000-08-10",
  displayDate: "10/08/2000",
  daysUntil: 25,
  nextDate: "2026-08-10",
  isToday: false,
  taskCycleYear: 2026,
  taskCycleMonth: 8,
  taskEligible: true,
  taskStatus: "not_created",
  taskId: null,
  taskError: null,
  taskUpdatedAt: null,
};

afterEach(() => vi.restoreAllMocks());

describe("createBirthdayTask", () => {
  it("envia a criação elegível ao endpoint real", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      employee: person.name,
      cycle: "2026-08",
      taskId: "456",
      result: "created",
      forcedEarly: false,
    }), { status: 200 }));
    const result = await createBirthdayTask("session-token", person, false);
    expect(result.result).toBe("created");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      action: "manual_create",
      bitrix_user_id: "123",
      cycle_year: 2026,
      cycle_month: 8,
      force_early: false,
    });
  });

  it("envia confirmação explícita na criação antecipada", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      result: "already_exists",
      taskId: "456",
      forcedEarly: true,
    }), { status: 200 }));
    expect((await createBirthdayTask("session-token", person, true)).result).toBe("already_exists");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)).force_early).toBe(true);
  });

  it.each([
    [409, "EARLY_CONFIRMATION_REQUIRED"],
    [403, undefined],
    [502, undefined],
  ] as const)("preserva falha HTTP %s", async (status, code) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: "Falha controlada", code }), { status }));
    const error = await createBirthdayTask("session-token", person).catch((caught) => caught);
    expect(error).toBeInstanceOf(BirthdayTaskRequestError);
    expect(error).toMatchObject({ status, code });
  });
});
