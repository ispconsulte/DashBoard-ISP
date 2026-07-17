import { describe, expect, it } from "vitest";
import {
  buildBirthdayTaskContract,
  cyclesToProcess,
  eligibleCycleEnd,
  isCycleEligible,
  nextBirthdayOccurrence,
  shouldRetryBitrixRequest,
} from "../../../../backend/supabase/functions/_shared/birthday-task-contract";

const atSaoPauloNoon = (isoDate: string) => new Date(`${isoDate}T15:00:00.000Z`);

describe("automação de tarefas de aniversário", () => {
  it("libera o mês atual antes do dia 20 e o mês seguinte a partir do dia 20", () => {
    expect(eligibleCycleEnd(atSaoPauloNoon("2026-07-19"))).toEqual({ year: 2026, month: 7 });
    expect(eligibleCycleEnd(atSaoPauloNoon("2026-07-20"))).toEqual({ year: 2026, month: 8 });
  });

  it("recupera ciclos perdidos após indisponibilidade ou reinício", () => {
    const now = atSaoPauloNoon("2026-07-20");
    expect(cyclesToProcess("2026-05-01", now)).toEqual([
      { year: 2026, month: 6 },
      { year: 2026, month: 7 },
      { year: 2026, month: 8 },
    ]);
    expect(cyclesToProcess("2026-05-01", now)).toEqual(cyclesToProcess("2026-05-01", now));
  });

  it("revalida diariamente o ciclo atual para captar aniversários corrigidos", () => {
    expect(cyclesToProcess("2026-07-01", atSaoPauloNoon("2026-07-18"))).toEqual([
      { year: 2026, month: 7 },
    ]);
    expect(cyclesToProcess("2026-08-01", atSaoPauloNoon("2026-07-20"))).toEqual([
      { year: 2026, month: 8 },
    ]);
  });

  it("distingue criação elegível de criação antecipada", () => {
    const now = atSaoPauloNoon("2026-07-16");
    expect(isCycleEligible({ year: 2026, month: 7 }, now)).toBe(true);
    expect(isCycleEligible({ year: 2026, month: 8 }, now)).toBe(false);
  });

  it("preserva o contrato Bitrix existente", () => {
    const contract = buildBirthdayTaskContract(
      "Colaborador Teste",
      { year: 2000, month: 8, day: 10 },
      { year: 2026, month: 8 },
    );
    expect(contract.title).toBe("🎂 [ANIVERSÁRIO | 10/08/2026] Preparativos — Colaborador Teste");
    expect(contract.deadline).toBe("2026-08-10T09:00:00-03:00");
    expect(contract.description).toContain("Responsável: Kayla Freitas Morais");
    expect(contract.description).toContain("Participante: Thalia Lourenço");
    expect(contract.checklist).toHaveLength(2);
  });

  it("normaliza 29 de fevereiro no próximo ciclo não bissexto", () => {
    const next = nextBirthdayOccurrence({ month: 2, day: 29 }, atSaoPauloNoon("2026-03-01"));
    expect(next.nextDate).toBe("2027-02-28");
  });

  it("repete somente falhas transitórias do Bitrix", () => {
    expect(shouldRetryBitrixRequest({ status: 429 })).toBe(true);
    expect(shouldRetryBitrixRequest({ status: 503 })).toBe(true);
    expect(shouldRetryBitrixRequest({ errorCode: "QUERY_LIMIT_EXCEEDED" })).toBe(true);
    expect(shouldRetryBitrixRequest({ errorName: "TimeoutError" })).toBe(true);
    expect(shouldRetryBitrixRequest({ status: 403, errorCode: "ACCESS_DENIED" })).toBe(false);
  });
});
