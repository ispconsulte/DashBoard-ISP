import { useEffect, useState } from "react";
import { CakeSlice, ChevronDown, Gift, Loader2, PartyPopper, Sparkles } from "lucide-react";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useBirthdays, type BirthdayPerson } from "@/modules/birthdays/api/useBirthdays";

type BirthdaysOverviewProps = {
  refreshKey?: number;
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

/** Paleta por mês — cada aniversariante ganha uma cor conforme o mês em que nasceu */
const MONTH_THEMES = [
  { grad: "from-rose-500 to-pink-600", ring: "ring-rose-400/30", text: "text-rose-300", chip: "bg-rose-400/10 text-rose-200/85", bar: "from-rose-400 to-pink-500" },
  { grad: "from-fuchsia-500 to-purple-600", ring: "ring-fuchsia-400/30", text: "text-fuchsia-300", chip: "bg-fuchsia-400/10 text-fuchsia-200/85", bar: "from-fuchsia-400 to-purple-500" },
  { grad: "from-violet-500 to-indigo-600", ring: "ring-violet-400/30", text: "text-violet-300", chip: "bg-violet-400/10 text-violet-200/85", bar: "from-violet-400 to-indigo-500" },
  { grad: "from-blue-500 to-cyan-600", ring: "ring-blue-400/30", text: "text-blue-300", chip: "bg-blue-400/10 text-blue-200/85", bar: "from-blue-400 to-cyan-500" },
  { grad: "from-teal-500 to-emerald-600", ring: "ring-teal-400/30", text: "text-teal-300", chip: "bg-teal-400/10 text-teal-200/85", bar: "from-teal-400 to-emerald-500" },
  { grad: "from-emerald-500 to-lime-600", ring: "ring-emerald-400/30", text: "text-emerald-300", chip: "bg-emerald-400/10 text-emerald-200/85", bar: "from-emerald-400 to-lime-500" },
  { grad: "from-amber-500 to-orange-600", ring: "ring-amber-400/30", text: "text-amber-300", chip: "bg-amber-400/10 text-amber-200/85", bar: "from-amber-400 to-orange-500" },
  { grad: "from-orange-500 to-rose-600", ring: "ring-orange-400/30", text: "text-orange-300", chip: "bg-orange-400/10 text-orange-200/85", bar: "from-orange-400 to-rose-500" },
  { grad: "from-red-500 to-fuchsia-600", ring: "ring-red-400/30", text: "text-red-300", chip: "bg-red-400/10 text-red-200/85", bar: "from-red-400 to-fuchsia-500" },
  { grad: "from-purple-500 to-violet-600", ring: "ring-purple-400/30", text: "text-purple-300", chip: "bg-purple-400/10 text-purple-200/85", bar: "from-purple-400 to-violet-500" },
  { grad: "from-indigo-500 to-blue-600", ring: "ring-indigo-400/30", text: "text-indigo-300", chip: "bg-indigo-400/10 text-indigo-200/85", bar: "from-indigo-400 to-blue-500" },
  { grad: "from-cyan-500 to-teal-600", ring: "ring-cyan-400/30", text: "text-cyan-300", chip: "bg-cyan-400/10 text-cyan-200/85", bar: "from-cyan-400 to-teal-500" },
];

function themeFor(person: BirthdayPerson) {
  return MONTH_THEMES[(person.month - 1 + 12) % 12];
}

/** Agrupa por mês da próxima ocorrência, mantendo a ordem cronológica (mais próximo primeiro) */
function groupByUpcomingMonth(people: BirthdayPerson[]) {
  const groups: { month: number; people: BirthdayPerson[] }[] = [];
  for (const person of people) {
    const nextMonth = new Date(person.nextDate).getMonth() + 1;
    const month = Number.isNaN(nextMonth) ? person.month : nextMonth;
    const group = groups.find((g) => g.month === month);
    if (group) group.people.push(person);
    else groups.push({ month, people: [person] });
  }
  return groups;
}

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
  return `${person.daysUntil} dias`;
}

/** Progresso visual de proximidade (mais preenchido = mais perto), numa janela de 90 dias */
function proximityPercent(daysUntil: number) {
  const window = 90;
  const clamped = Math.min(Math.max(daysUntil, 0), window);
  return Math.round((1 - clamped / window) * 100);
}

function BirthdayCard({
  person,
  index,
  featured = false,
}: {
  person: BirthdayPerson;
  index: number;
  featured?: boolean;
}) {
  const age = turningAge(person);
  const theme = themeFor(person);
  const progress = Math.max(proximityPercent(person.daysUntil), person.isToday ? 100 : 6);

  return (
    <div
      className={`animate-pop-in group relative overflow-hidden rounded-xl border p-3.5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/20 ${
        featured
          ? "border-fuchsia-300/25 bg-fuchsia-300/[0.06] hover:border-fuchsia-300/40"
          : "border-white/[0.07] bg-white/[0.025] hover:border-white/[0.14] hover:bg-white/[0.05]"
      }`}
      style={{ animationDelay: `${index * 55}ms` }}
    >
      <div
        className={`pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-gradient-to-br ${theme.grad} opacity-[0.12] blur-2xl transition-opacity duration-300 group-hover:opacity-25`}
      />

      <div className="relative flex items-start gap-3">
        <div
          className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${theme.grad} text-xs font-bold text-white shadow-lg ring-2 ${theme.ring}`}
        >
          {person.isToday && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] shadow shadow-amber-950/50 animate-bounce">
              🎉
            </span>
          )}
          {initials(person.name)}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-white/90">{person.name}</p>
          <p className={`mt-0.5 text-[11px] font-medium ${theme.text}`}>
            {birthdayDayMonthLabel(person)}
            {age !== null ? ` · ${age} anos` : ""}
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
            person.isToday ? "bg-amber-300/15 text-amber-200" : theme.chip
          }`}
        >
          {countdownLabel(person)}
        </span>
      </div>

      <div className="relative mt-3 space-y-1.5">
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${theme.bar} transition-all duration-700 ease-out`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-white/45">
          <span>Aniversário {nextOccurrenceLabel(person)}</span>
          <span className="text-white/25">completa {age} anos</span>
        </div>
      </div>
    </div>
  );
}

function BirthdaysOverview({ refreshKey = 0 }: BirthdaysOverviewProps) {
  const { session } = useAuth();
  const isInternal = session?.role !== "cliente";
  const { data, isLoading, isFetching, error, refetch } = useBirthdays(
    isInternal ? session?.accessToken : undefined,
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (refreshKey > 0) void refetch();
  }, [refreshKey, refetch]);

  if (!isInternal) return null;

  const birthdays = data?.birthdays ?? [];
  const nextBirthday = birthdays[0];
  const previewStack = birthdays.slice(0, 4);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-slate-950/40 shadow-xl backdrop-blur-md">
      <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 animate-float-slow rounded-full bg-fuchsia-500/15 blur-3xl" />
      <div
        className="pointer-events-none absolute -bottom-20 left-1/4 h-44 w-44 animate-float-slow rounded-full bg-indigo-500/10 blur-3xl"
        style={{ animationDelay: "1.5s" }}
      />

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-white/[0.03] sm:px-5"
        aria-expanded={open}
      >
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 shadow-lg shadow-fuchsia-950/40">
          <CakeSlice className="h-4.5 w-4.5 text-white" />
          <Sparkles className="absolute -right-1.5 -top-1.5 h-3.5 w-3.5 text-amber-300 drop-shadow" />
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
            <p className="mt-0.5 text-xs text-white/40">Datas de nascimento completas da equipe</p>
          ) : (
            <p className="mt-0.5 text-xs text-white/40">Nenhum aniversário encontrado.</p>
          )}
        </div>

        {!isLoading && !error && previewStack.length > 0 && (
          <div className="hidden shrink-0 items-center sm:flex">
            {previewStack.map((person, i) => {
              const theme = themeFor(person);
              return (
                <div
                  key={person.bitrixUserId}
                  className={`-ml-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[hsl(270_45%_11%)] bg-gradient-to-br ${theme.grad} text-[9px] font-bold text-white first:ml-0`}
                  style={{ zIndex: previewStack.length - i }}
                  title={person.name}
                >
                  {initials(person.name)}
                </div>
              );
            })}
          </div>
        )}

        {isFetching && !isLoading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-violet-300/70" />}

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-white/40 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div
        className={`relative grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-white/[0.06] px-4 pb-4 pt-4 sm:px-5">
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
              <div className="max-h-[30rem] space-y-5 overflow-y-auto pr-1.5 scrollbar-thin scrollbar-track-white/[0.02] scrollbar-thumb-white/[0.08] hover:scrollbar-thumb-white/[0.12]">
                {nextBirthday && (
                  <div>
                    <p className="sticky top-0 z-10 mb-2 flex items-center gap-1.5 bg-slate-950/80 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-fuchsia-200/55 backdrop-blur-sm">
                      <PartyPopper className="h-3.5 w-3.5" />
                      Próximo aniversário
                    </p>
                    <div className="max-w-sm">
                      <BirthdayCard person={nextBirthday} index={0} featured />
                    </div>
                  </div>
                )}

                {birthdays.length > 1 &&
                  groupByUpcomingMonth(birthdays.slice(1)).map((group) => (
                    <div key={group.month}>
                      <p className="sticky top-0 z-10 mb-2 bg-slate-950/80 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35 backdrop-blur-sm">
                        {MONTH_NAMES[group.month - 1]}
                      </p>
                      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                        {group.people.map((person, index) => (
                          <BirthdayCard key={`${person.bitrixUserId}-${person.nextDate}`} person={person} index={index} />
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default BirthdaysOverview;
