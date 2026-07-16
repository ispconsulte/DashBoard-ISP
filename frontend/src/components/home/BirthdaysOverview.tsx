import { useEffect, useState } from "react";
import { CakeSlice, ChevronDown, Gift, Loader2, PartyPopper, Sparkles, Hourglass } from "lucide-react";
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
  { grad: "from-slate-700 to-slate-800", ring: "ring-slate-600/30", text: "text-slate-400", chip: "bg-slate-700/30 text-slate-300", bar: "from-slate-500 to-slate-600" },
  { grad: "from-slate-700 to-slate-800", ring: "ring-slate-600/30", text: "text-slate-400", chip: "bg-slate-700/30 text-slate-300", bar: "from-slate-500 to-slate-600" },
  { grad: "from-slate-700 to-slate-800", ring: "ring-slate-600/30", text: "text-slate-400", chip: "bg-slate-700/30 text-slate-300", bar: "from-slate-500 to-slate-600" },
  { grad: "from-slate-700 to-slate-800", ring: "ring-slate-600/30", text: "text-slate-400", chip: "bg-slate-700/30 text-slate-300", bar: "from-slate-500 to-slate-600" },
  { grad: "from-slate-700 to-slate-800", ring: "ring-slate-600/30", text: "text-slate-400", chip: "bg-slate-700/30 text-slate-300", bar: "from-slate-500 to-slate-600" },
  { grad: "from-slate-700 to-slate-800", ring: "ring-slate-600/30", text: "text-slate-400", chip: "bg-slate-700/30 text-slate-300", bar: "from-slate-500 to-slate-600" },
  { grad: "from-slate-700 to-slate-800", ring: "ring-slate-600/30", text: "text-slate-400", chip: "bg-slate-700/30 text-slate-300", bar: "from-slate-500 to-slate-600" },
  { grad: "from-slate-700 to-slate-800", ring: "ring-slate-600/30", text: "text-slate-400", chip: "bg-slate-700/30 text-slate-300", bar: "from-slate-500 to-slate-600" },
  { grad: "from-slate-700 to-slate-800", ring: "ring-slate-600/30", text: "text-slate-400", chip: "bg-slate-700/30 text-slate-300", bar: "from-slate-500 to-slate-600" },
  { grad: "from-slate-700 to-slate-800", ring: "ring-slate-600/30", text: "text-slate-400", chip: "bg-slate-700/30 text-slate-300", bar: "from-slate-500 to-slate-600" },
  { grad: "from-slate-700 to-slate-800", ring: "ring-slate-600/30", text: "text-slate-400", chip: "bg-slate-700/30 text-slate-300", bar: "from-slate-500 to-slate-600" },
  { grad: "from-slate-700 to-slate-800", ring: "ring-slate-600/30", text: "text-slate-400", chip: "bg-slate-700/30 text-slate-300", bar: "from-slate-500 to-slate-600" },
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
  // Use day/month directly from person object to avoid timezone/nextDate mismatch issues
  const today = new Date();
  const year = today.getFullYear();
  const birthdayThisYear = new Date(year, person.month - 1, person.day);
  
  // If birthday already happened this year, next one is next year
  if (birthdayThisYear < today && !person.isToday) {
    return `${pad2(person.day)}/${pad2(person.month)}/${year + 1}`;
  }
  return `${pad2(person.day)}/${pad2(person.month)}/${year}`;
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
      className={`animate-pop-in group relative overflow-hidden rounded-xl border p-3.5 transition-all duration-400 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/10 ${
        featured
          ? "border-primary/30 bg-primary/[0.04]"
          : "border-white/5 bg-white/[0.01] hover:border-white/10"
      }`}
      style={{ animationDelay: `${index * 55}ms` }}
    >
      <div
        className={`pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-primary/20 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100`}
      />

      <div className="relative flex items-start gap-3">
        <div
          className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-300 shadow-lg ring-2 ring-slate-700/50`}
        >
          {person.isToday && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] shadow shadow-amber-950/50 animate-bounce">
              🎉
            </span>
          )}
          {initials(person.name)}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-white/95">{person.name}</p>
          <p className={`mt-0.5 text-[11px] font-medium ${theme.text}`}>
            Data de nascimento: {birthDateLabel(person)}
          </p>
        </div>

        <div className="flex h-6 items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-500">
          <Hourglass className="h-3 w-3 animate-spin [animation-duration:3s]" />
          {countdownLabel(person)}
        </div>
      </div>

      <div className="relative mt-3 space-y-1.5">
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${theme.bar} transition-all duration-700 ease-out`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-white/45">
          <span>Data do aniversário: {nextOccurrenceLabel(person)}</span>
          <span className="text-white/35">{person.name.split(' ')[0]} vai completar {age} anos</span>
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
  

  return (
    <section className="task-card relative overflow-hidden p-0 transition-all duration-300">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-white/[0.03] sm:px-5"
        aria-expanded={open}
      >
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 shadow-lg shadow-primary/5">
          <CakeSlice className="h-4.5 w-4.5 text-primary" />
          <Sparkles className="absolute -right-1.5 -top-1.5 h-3.5 w-3.5 text-amber-300 drop-shadow" />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-white">Aniversários do time ISP Consulte</h2>

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


        {isFetching && !isLoading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary/50" />}

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
          <div className="px-4 pb-5 pt-4 sm:px-5">
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
              <div className="max-h-[30rem] space-y-6 overflow-y-auto pr-1.5 scrollbar-thin scrollbar-track-white/[0.02] scrollbar-thumb-white/[0.08] hover:scrollbar-thumb-white/[0.12]">
                {birthdays.length > 0 &&
                  groupByUpcomingMonth(birthdays).map((group) => (
                    <div key={group.month}>
                      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/15">
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
