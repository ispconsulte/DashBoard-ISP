export type Birthday = { year: number; month: number; day: number };
export type BirthdayCycle = { year: number; month: number };

export type BirthdayTaskContract = {
  birthDate: string;
  celebrationDate: string;
  title: string;
  description: string;
  deadline: string;
  checklist: string[];
};

export function parseBirthday(value: unknown): Birthday | null {
  const raw = String(value ?? "").trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const br = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  const year = Number(iso?.[1] ?? br?.[3]);
  const month = Number(iso?.[2] ?? br?.[2]);
  const day = Number(iso?.[3] ?? br?.[1]);
  if (!year || !month || !day || month > 12 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function cycleKey(cycle: BirthdayCycle) {
  return `${cycle.year}-${pad(cycle.month)}`;
}

export function parseCycle(value: unknown): BirthdayCycle | null {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})/);
  const year = Number(match?.[1]);
  const month = Number(match?.[2]);
  return year >= 2000 && month >= 1 && month <= 12 ? { year, month } : null;
}

export function compareCycles(left: BirthdayCycle, right: BirthdayCycle) {
  return left.year * 12 + left.month - (right.year * 12 + right.month);
}

export function addMonths(cycle: BirthdayCycle, amount: number): BirthdayCycle {
  const index = cycle.year * 12 + (cycle.month - 1) + amount;
  return { year: Math.floor(index / 12), month: (index % 12 + 12) % 12 + 1 };
}

export function saoPauloDateParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: value("year"), month: value("month"), day: value("day") };
}

export function eligibleCycleEnd(now = new Date()): BirthdayCycle {
  const local = saoPauloDateParts(now);
  const current = { year: local.year, month: local.month };
  return local.day >= 20 ? addMonths(current, 1) : current;
}

export function isCycleEligible(cycle: BirthdayCycle, now = new Date()) {
  return compareCycles(cycle, eligibleCycleEnd(now)) <= 0;
}

export function nextBirthdayOccurrence(birthday: Pick<Birthday, "month" | "day">, now = new Date()) {
  const local = saoPauloDateParts(now);
  let cycle = { year: local.year, month: birthday.month };
  let day = Math.min(birthday.day, daysInMonth(cycle.year, cycle.month));
  const todayKey = `${local.year}-${pad(local.month)}-${pad(local.day)}`;
  if (`${cycle.year}-${pad(cycle.month)}-${pad(day)}` < todayKey) {
    cycle = { year: local.year + 1, month: birthday.month };
    day = Math.min(birthday.day, daysInMonth(cycle.year, cycle.month));
  }
  const todayUtc = Date.UTC(local.year, local.month - 1, local.day);
  const occurrenceUtc = Date.UTC(cycle.year, cycle.month - 1, day);
  return {
    cycle,
    day,
    daysUntil: Math.round((occurrenceUtc - todayUtc) / 86_400_000),
    nextDate: `${cycle.year}-${pad(cycle.month)}-${pad(day)}`,
  };
}

export function shouldRetryBitrixRequest(input: {
  status?: number;
  errorCode?: string;
  errorName?: string;
  errorMessage?: string;
}) {
  return input.status === 429
    || Number(input.status ?? 0) >= 500
    || String(input.errorCode ?? "").includes("QUERY_LIMIT")
    || input.errorName === "TimeoutError"
    || /fetch|network|timeout/i.test(String(input.errorMessage ?? ""));
}

export function cyclesToProcess(lastCompletedCycle: unknown, now = new Date(), maxCycles = 12) {
  const local = saoPauloDateParts(now);
  const current = { year: local.year, month: local.month };
  const end = eligibleCycleEnd(now);
  const previous = parseCycle(lastCompletedCycle);
  // Reprocessa o ciclo elegível mais recente todos os dias. A identidade
  // idempotente impede duplicatas e permite captar aniversários corrigidos
  // depois que o cursor mensal já foi concluído.
  let cursor = previous
    ? compareCycles(previous, end) < 0
      ? addMonths(previous, 1)
      : end
    : current;
  const cycles: BirthdayCycle[] = [];
  while (compareCycles(cursor, end) <= 0 && cycles.length < maxCycles) {
    cycles.push(cursor);
    cursor = addMonths(cursor, 1);
  }
  return cycles;
}

export function buildBirthdayTaskContract(
  employeeName: string,
  birthday: Birthday,
  cycle: BirthdayCycle,
): BirthdayTaskContract {
  const celebrationDay = Math.min(birthday.day, daysInMonth(cycle.year, cycle.month));
  const celebration = { year: cycle.year, month: cycle.month, day: celebrationDay };
  const cakeDue = shiftDate(cycle.year, cycle.month, celebrationDay, -2);
  const artDue = shiftDate(cycle.year, cycle.month, celebrationDay, -1);
  const birthDate = displayDate(birthday.year, birthday.month, birthday.day);
  const celebrationDate = displayDate(celebration.year, celebration.month, celebration.day);
  const checklist = [
    `${displayDate(cakeDue.year, cakeDue.month, cakeDue.day)} — Providenciar a compra/organização do bolo (2 dias antes)`,
    `${displayDate(artDue.year, artDue.month, artDue.day)} — Finalizar e programar a arte dos stories (1 dia antes)`,
  ];
  const description = [
    "LEMBRETE AUTOMÁTICO DE ANIVERSÁRIO",
    "",
    `Aniversariante: ${employeeName}`,
    `Data de nascimento: ${birthDate}`,
    `Data da comemoração: ${celebrationDate}`,
    `Idade que completa: ${cycle.year - birthday.year} anos`,
    "",
    `Bolo: organizar até ${displayDate(cakeDue.year, cakeDue.month, cakeDue.day)}.`,
    `Arte dos stories: finalizar até ${displayDate(artDue.year, artDue.month, artDue.day)}.`,
    "",
    "Responsável: Kayla Freitas Morais",
    "Participante: Thalia Lourenço",
    "",
    "Tarefa gerada automaticamente pelo ISP Consulte Dashboard.",
  ].join("\n");

  return {
    birthDate,
    celebrationDate,
    title: `🎂 [ANIVERSÁRIO | ${celebrationDate}] Preparativos — ${employeeName}`,
    description,
    deadline: `${isoDate(celebration.year, celebration.month, celebration.day)}T09:00:00-03:00`,
    checklist,
  };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function displayDate(year: number, month: number, day: number) {
  return `${pad(day)}/${pad(month)}/${year}`;
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function shiftDate(year: number, month: number, day: number, deltaDays: number) {
  const date = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}
