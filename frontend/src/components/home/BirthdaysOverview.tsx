import { forwardRef, useImperativeHandle, useState } from "react";
import { CakeSlice, ChevronDown, Gift, Loader2, PartyPopper } from "lucide-react";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useBirthdays, type BirthdayPerson } from "@/modules/birthdays/api/useBirthdays";

export type BirthdaysOverviewHandle = {
  refetch: () => void;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

const MONTH_NAMES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Data de nascimento completa, ex: "08/03/2001" */
function birthDateLabel(person: BirthdayPerson) {
  return `${pad2(person.day)}/${pad2(person.month)}/${person.year}`;
}

/** Dia e mês do aniversário, ex: "08 de março" */
function birthdayDayMonthLabel(person: BirthdayPerson) {
  return `${pad2(person.day)} de ${MONTH_NAMES[person.month - 1]}`;
}

/** Próxima data em que o aniversário será comemorado, ex: "08/03/2026" */
function nextOccurrenceLabel(person: BirthdayPerson) {
  const next = new Date(person.nextDate);
  if (Number.isNaN(next.getTime())) return person.displayDate;
  return `${pad2(next.getDate())}/${pad2(next.getMonth() + 1)}/${next.getFullYear()}`;
}

/** Idade que a pessoa vai completar na próxima data de aniversário */
function turningAge(person: BirthdayPerson) {
  const next = new Date(person.nextDate);
  if (Number.isNaN(next.getTime()) || !person.year) return null;
  return next.getFullYear() - person.year;
}

function countdownLabel(person: BirthdayPerson) {
  if (person.isToday) return "É hoje!";
  if (person.daysUntil === 1) return "Amanhã";
  return `Em ${person.daysUntil} dias`;
}

function BirthdayRow({ person, index }: { person: BirthdayPerson; index: number }) {
  const age = turningAge(person);

  return (
    <div
      className="animate-pop-in flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors duration-200 hover:border-violet-300/20 hover:bg-white/[0.04]"
      style={{ animationDelay: `${index * 45}ms` }}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white shadow ${
          person.isToday
            ? "bg-gradient-to-br from-amber-400 to-fuchsia-500"
            : "bg-gradient-to-br from-violet-600/80 to-indigo-600/80"
        }`}
      >
        {initials(person.name)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-white/90">{person.name}</p>
        <p className="mt-0.5 truncate text-[11px] text-white/40">
          Nasceu {birthDateLabel(person)} · faz aniversário {birthdayDayMonthLabel(person)}
          {age !== null ? ` (${age} anos)` : ""}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            person.isToday ? "bg-amber-300/15 text-amber-200" : "bg-violet-300/10 text-violet-200/80"
          }`}
        >
          {countdownLabel(person)}
        </span>
        <span className="text-[10px] text-white/30">{nextOccurrenceLabel(person)}</span>
      </div>
    </div>
  );
}

const BirthdaysOverview = forwardRef<BirthdaysOverviewHandle>(function BirthdaysOverview(_props, ref) {
  const { session } = useAuth();
  const isInternal = session?.role !== "cliente";
  const { data, isLoading, isFetching, error, refetch } = useBirthdays(
    isInternal ? session?.accessToken : undefined,
  );
  const [open, setOpen] = useState(false);

  useImperativeHandle(ref, () => ({
    refetch: () => void refetch(),
  }), [refetch]);

  if (!isInternal) return null;

  const birthdays = data?.birthdays ?? [];
  const nextBirthday = birthdays[0];
  const restBirthdays = birthdays.slice(1);
  const nextAge = nextBirthday ? turningAge(nextBirthday) : null;

  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[linear-gradient(145deg,hsl(270_50%_14%/0.82),hsl(234_45%_10%/0.7))] shadow-xl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03] sm:px-5"
        aria-expanded={open}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-violet-600 shadow shadow-fuchsia-950/30">
          <CakeSlice className="h-4 w-4 text-white" />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-white">Aniversários no Bitrix</h2>

          {isLoading ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/40">
              <Loader2 className="h-3 w-3 animate-spin" /> Carregando...
            </p>
          ) : error ? (
            <p className="mt-0.5 text-xs text-rose-300/70">Falha ao carregar aniversários.</p>
          ) : nextBirthday ? (
            <p className="mt-0.5 truncate text-xs text-white/45">
              Próximo:{" "}
              <span className="font-medium text-white/70">{nextBirthday.name}</span>{" "}
              · {birthdayDayMonthLabel(nextBirthday)}
              {nextAge !== null ? ` (${nextAge} anos)` : ""} ·{" "}
              <span className={nextBirthday.isToday ? "font-semibold text-amber-300" : ""}>
                {countdownLabel(nextBirthday)}
              </span>
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-white/40">Nenhum aniversário encontrado.</p>
          )}
        </div>

        {isFetching && !isLoading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-violet-300/70" />}

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-white/40 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-white/[0.06] px-4 pb-4 pt-3 sm:px-5">
            {error ? (
              <div className="rounded-xl border border-rose-300/10 bg-rose-400/[0.06] px-4 py-4 text-sm text-rose-100/75">
                <p className="font-semibold">Não foi possível carregar os aniversários.</p>
                <p className="mt-1 text-xs text-rose-100/50">{error.message}</p>
              </div>
            ) : !nextBirthday && !isLoading ? (
              <div className="flex min-h-20 flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] text-center">
                <Gift className="mb-2 h-5 w-5 text-violet-300/60" />
                <p className="text-sm font-medium text-white/70">Nenhum aniversário encontrado</p>
                <p className="mt-1 text-xs text-white/35">Preencha a data de nascimento nos perfis do Bitrix.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {nextBirthday && (
                  <div className="animate-pop-in flex items-center gap-3 rounded-lg border border-fuchsia-300/20 bg-fuchsia-300/[0.07] px-3 py-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 text-[11px] font-bold text-white shadow shadow-fuchsia-950/40">
                      {initials(nextBirthday.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-[13px] font-semibold text-white/90">
                        <PartyPopper className="h-3 w-3 shrink-0 text-fuchsia-300/80" />
                        {nextBirthday.name}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-white/45">
                        Nasceu {birthDateLabel(nextBirthday)} · comemora em {nextOccurrenceLabel(nextBirthday)}
                        {nextAge !== null ? ` (${nextAge} anos)` : ""}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        nextBirthday.isToday
                          ? "animate-pulse bg-amber-300/15 text-amber-200"
                          : "bg-violet-300/10 text-violet-200/80"
                      }`}
                    >
                      {countdownLabel(nextBirthday)}
                    </span>
                  </div>
                )}

                {restBirthdays.map((person, index) => (
                  <BirthdayRow key={`${person.bitrixUserId}-${person.nextDate}`} person={person} index={index} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
});

export default BirthdaysOverview;
