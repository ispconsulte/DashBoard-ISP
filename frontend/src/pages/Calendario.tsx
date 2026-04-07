import { useMemo, useState } from "react";
import PageHeaderCard from "@/components/PageHeaderCard";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  CheckCircle2,
  User,
  Calendar,
} from "lucide-react";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useTasks } from "@/modules/tasks/api/useTasks";
import { useSharedTasks } from "@/contexts/SharedTasksContext";
import { normalizeTaskTitle, parseDateValue } from "@/modules/tasks/utils";
import { usePageSEO } from "@/hooks/usePageSEO";

function getTaskStatusKey(t: Record<string, any>): string {
  const statusRaw = String(t.status ?? t.situacao ?? "").toLowerCase();
  const isDone = ["5", "done", "concluido", "concluído", "completed", "finalizado"].includes(statusRaw);
  if (isDone) return "done";
  const deadline = parseDateValue(t.deadline) ?? parseDateValue(t.due_date) ?? parseDateValue(t.dueDate);
  if (deadline && deadline < new Date()) return "overdue";
  return "pending";
}

const WEEKDAYS_SHORT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const STATUS_CONFIG: Record<string, { dot: string; line: string; text: string; label: string; icon: typeof CheckCircle2 }> = {
  overdue: {
    dot: "bg-rose-400",
    line: "bg-rose-400",
    text: "text-rose-400",
    label: "Atrasada",
    icon: AlertTriangle,
  },
  pending: {
    dot: "bg-amber-400",
    line: "bg-amber-400",
    text: "text-amber-400",
    label: "Pendente",
    icon: Clock,
  },
  done: {
    dot: "bg-emerald-400",
    line: "bg-emerald-400",
    text: "text-emerald-400",
    label: "Concluída",
    icon: CheckCircle2,
  },
  unknown: {
    dot: "bg-[hsl(var(--muted-foreground))]",
    line: "bg-[hsl(var(--muted-foreground))]",
    text: "text-muted-foreground",
    label: "Sem status",
    icon: Clock,
  },
};

type CalendarTask = {
  title: string;
  project: string;
  statusKey: string;
  deadline: Date;
  consultant: string;
};

type CalendarCell = {
  date: Date;
  inCurrentMonth: boolean;
};

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells: CalendarCell[] = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({
      date: new Date(year, month - 1, prevMonthDays - i),
      inCurrentMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: new Date(year, month, day), inCurrentMonth: true });
  }

  const remaining = 42 - cells.length;
  for (let day = 1; day <= remaining; day++) {
    cells.push({ date: new Date(year, month + 1, day), inCurrentMonth: false });
  }

  return cells;
}

export default function Calendario() {
  usePageSEO("/calendario");
  const { session } = useAuth();
  // Reuse shared 180d tasks from layout (period "all" maps to 180d internally)
  const shared = useSharedTasks();
  const ownTasks = useTasks({ accessToken: session?.accessToken, period: "all" });
  const { tasks } = shared ?? ownTasks;
  const isAdmin = session?.role === "admin" || session?.role === "gerente" || session?.role === "coordenador";

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(new Date(now.getFullYear(), now.getMonth(), now.getDate()));

  const calendarTasks = useMemo<CalendarTask[]>(() => {
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const userName = session?.name ? norm(session.name) : "";

    return tasks
      .map((t) => {
        const deadline = parseDateValue(t.deadline) ?? parseDateValue(t.due_date) ?? parseDateValue(t.dueDate);
        if (!deadline) return null;

        const consultant = String(t.responsible_name ?? t.consultant ?? t.owner ?? t.responsavel ?? "");

        // For non-admin users, only show their own tasks
        if (!isAdmin && userName) {
          const responsible = norm(consultant);
          if (!responsible || (!responsible.includes(userName) && !userName.includes(responsible))) {
            return null;
          }
        }

        return {
          title: normalizeTaskTitle(String(t.title ?? t.nome ?? t.name ?? "Tarefa")),
          project: String(t.projects?.name ?? t.project_name ?? t.project ?? ""),
          statusKey: getTaskStatusKey(t),
          deadline,
          consultant,
        };
      })
      .filter(Boolean) as CalendarTask[];
  }, [tasks, isAdmin, session?.name]);

  const tasksMap = useMemo(() => {
    const map = new Map<string, CalendarTask[]>();
    calendarTasks.forEach((task) => {
      const key = `${task.deadline.getFullYear()}-${task.deadline.getMonth()}-${task.deadline.getDate()}`;
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    });
    return map;
  }, [calendarTasks]);

  const monthCells = useMemo(() => buildMonthGrid(year, month), [year, month]);

  const selectedTasks = useMemo(() => {
    const key = `${selectedDay.getFullYear()}-${selectedDay.getMonth()}-${selectedDay.getDate()}`;
    const items = tasksMap.get(key) ?? [];
    const order: Record<string, number> = { overdue: 0, pending: 1, done: 2 };
    return [...items].sort((a, b) => (order[a.statusKey] ?? 3) - (order[b.statusKey] ?? 3));
  }, [selectedDay, tasksMap]);

  const monthStats = useMemo(() => {
    let overdue = 0;
    let pending = 0;
    let done = 0;

    calendarTasks.forEach((task) => {
      if (task.deadline.getMonth() === month && task.deadline.getFullYear() === year) {
        if (task.statusKey === "overdue") overdue += 1;
        else if (task.statusKey === "done") done += 1;
        else pending += 1;
      }
    });

    return { overdue, pending, done };
  }, [calendarTasks, month, year]);

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((v) => v - 1);
    } else {
      setMonth((v) => v - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((v) => v + 1);
    } else {
      setMonth((v) => v + 1);
    }
  };

  return (
    <div className="page-gradient w-full">
      <div className="mx-auto w-full max-w-[1900px] space-y-5 p-4 sm:p-5 md:p-8">
        <PageHeaderCard
          icon={CalendarDays}
          title={`Olá, ${session?.name?.split(" ")[0] || "Equipe"}!`}
          subtitle="Aqui está sua agenda de entregas do dia."
          actions={
            <button
              onClick={() => { setSelectedDay(new Date(now.getFullYear(), now.getMonth(), now.getDate())); setMonth(now.getMonth()); setYear(now.getFullYear()); }}
              className="flex items-center gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-white/50 transition-all hover:border-white/[0.15] hover:bg-white/[0.05] hover:text-white/70"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Hoje
            </button>
          }
        />

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-[26px] border border-white/[0.08] bg-[hsl(var(--card)/0.75)] shadow-[0_30px_80px_hsl(260_60%_2%/0.55)]"
        >

          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="p-2.5 sm:p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button onClick={prevMonth} className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.02] text-muted-foreground transition hover:text-foreground">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-sm font-semibold text-foreground">
                    {MONTHS[month]} {year}
                  </div>
                  <button onClick={nextMonth} className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.02] text-muted-foreground transition hover:text-foreground">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="hidden items-center gap-2 sm:flex">
                  <BadgeInfo label="Atrasadas" value={monthStats.overdue} color="text-rose-400" />
                  <BadgeInfo label="Pendentes" value={monthStats.pending} color="text-amber-400" />
                  <BadgeInfo label="Concluídas" value={monthStats.done} color="text-emerald-400" />
                </div>
              </div>

              <div className="mb-3 grid grid-cols-3 gap-1 sm:hidden">
                <BadgeInfo label="Atras." value={monthStats.overdue} color="text-rose-400" />
                <BadgeInfo label="Pend." value={monthStats.pending} color="text-amber-400" />
                <BadgeInfo label="Conc." value={monthStats.done} color="text-emerald-400" />
              </div>

              <div className="pb-1">
                <div>
                  <div className="grid grid-cols-7 gap-0.5 sm:gap-2">
                    {WEEKDAYS_SHORT.map((day, i) => (
                      <div key={day} className="px-0 py-1 text-center text-[8px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60 sm:px-1 sm:text-[11px] sm:tracking-[0.12em]">
                        <span className="hidden sm:inline">{day}</span>
                        <span className="sm:hidden">{["D", "S", "T", "Q", "Q", "S", "S"][i]}</span>
                      </div>
                    ))}

                    {monthCells.map((cell, index) => {
                      const date = cell.date;
                      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
                      const dayTasks = tasksMap.get(key) ?? [];
                      const isSelected = isSameDay(date, selectedDay);
                      const isToday = isSameDay(date, now);
                      const overdueCount = dayTasks.filter(t => t.statusKey === "overdue").length;
                      const pendingCount = dayTasks.filter(t => t.statusKey === "pending").length;
                      const doneCount = dayTasks.filter(t => t.statusKey === "done").length;

                      // Determine dominant status for cell bg tint
                      let cellBg = "bg-white/[0.02]";
                      let cellBorder = "border-white/[0.06]";
                      if (cell.inCurrentMonth && dayTasks.length > 0) {
                        if (overdueCount > 0) {
                          cellBg = "bg-rose-500/[0.08]";
                          cellBorder = "border-rose-500/[0.2]";
                        } else if (pendingCount > 0) {
                          cellBg = "bg-amber-500/[0.08]";
                          cellBorder = "border-amber-500/[0.2]";
                        } else if (doneCount > 0) {
                          cellBg = "bg-emerald-500/[0.08]";
                          cellBorder = "border-emerald-500/[0.2]";
                        }
                      }

                      return (
                        <motion.button
                          key={`${key}-${index}`}
                          onClick={() => setSelectedDay(date)}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.98 }}
                          transition={{ type: "spring", stiffness: 360, damping: 22 }}
                          className={`group relative min-h-[52px] rounded-lg border p-1 text-left transition-all sm:min-h-[92px] sm:rounded-2xl sm:p-2 lg:min-h-[98px] ${
                            isSelected
                              ? "border-[hsl(var(--task-purple)/0.55)] bg-[hsl(var(--task-purple)/0.15)] ring-1 ring-[hsl(var(--task-purple)/0.3)]"
                              : `${cellBorder} ${cellBg} hover:bg-white/[0.05]`
                          } ${!cell.inCurrentMonth ? "opacity-40" : "opacity-100"}`}
                        >
                          <span className={`text-xs font-semibold sm:text-sm ${isToday ? "text-[hsl(var(--task-purple))]" : "text-foreground/80"}`}>
                            {date.getDate()}
                          </span>

                          {dayTasks.length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.05 }}
                              className="mt-0.5 space-y-0 sm:mt-1.5 sm:space-y-0.5"
                            >
                              <p className="text-[9px] font-bold text-foreground/90 sm:text-[11px]">{dayTasks.length} <span className="hidden sm:inline">tarefa{dayTasks.length > 1 ? "s" : ""}</span></p>
                              <div className="hidden flex-col gap-0.5 text-[10px] font-semibold sm:flex">
                                {overdueCount > 0 && <span className="text-rose-400">{overdueCount} atrasada{overdueCount > 1 ? "s" : ""}</span>}
                                {pendingCount > 0 && <span className="text-amber-400">{pendingCount} pendente{pendingCount > 1 ? "s" : ""}</span>}
                                {doneCount > 0 && <span className="text-emerald-400">{doneCount} concluída{doneCount > 1 ? "s" : ""}</span>}
                              </div>
                              {/* Mobile: colored dots only */}
                              <div className="flex gap-0.5 sm:hidden">
                                {overdueCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />}
                                {pendingCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
                                {doneCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                              </div>
                            </motion.div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <aside className="border-t border-white/[0.06] bg-white/[0.02] p-3 sm:p-4 lg:border-l lg:border-t-0">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-foreground">Agenda do dia</p>
                  <p className="text-[11px] text-muted-foreground">
                    {selectedDay.getDate()} de {MONTHS[selectedDay.getMonth()]}, {selectedDay.getFullYear()}
                  </p>
                </div>
                <Calendar className="h-4 w-4 text-[hsl(var(--task-purple))]" />
              </div>

              <AnimatePresence mode="wait">
                {selectedTasks.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="rounded-2xl border border-dashed border-white/[0.1] p-5 text-center sm:p-6"
                  >
                    <p className="text-sm text-muted-foreground">Sem tarefas neste dia.</p>
                  </motion.div>
                ) : (
                  <motion.div key="tasks" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="styled-scrollbar space-y-2.5 overflow-y-auto pr-1 max-h-[52vh] sm:max-h-[60vh] lg:max-h-[calc(100vh-13rem)]">
                    {selectedTasks.map((task, idx) => {
                      const cfg = STATUS_CONFIG[task.statusKey] ?? STATUS_CONFIG.unknown;
                      const Icon = cfg.icon;
                      const cardBg = task.statusKey === "overdue"
                        ? "bg-rose-500/[0.1] border-rose-500/[0.25]"
                        : task.statusKey === "pending"
                        ? "bg-amber-500/[0.08] border-amber-500/[0.2]"
                        : task.statusKey === "done"
                        ? "bg-emerald-500/[0.08] border-emerald-500/[0.2]"
                        : "bg-white/[0.03] border-white/[0.08]";
                      return (
                        <motion.div
                          key={`${task.title}-${idx}`}
                          initial={{ opacity: 0, x: 12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05, duration: 0.25 }}
                          className={`rounded-xl border p-3 ${cardBg}`}
                        >
                          <span className={`mb-2 block h-1 w-full rounded-full ${cfg.line}`} />
                          <div className="flex items-start gap-2.5">
                            <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06]">
                              <Icon className={`h-3.5 w-3.5 ${cfg.text}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-semibold text-foreground">{task.title}</p>
                              {task.project && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{task.project}</p>}
                              <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                                <span className={`font-bold ${cfg.text}`}>{cfg.label}</span>
                                {task.consultant && (
                                  <span className="inline-flex items-center gap-1 truncate">
                                    <User className="h-3 w-3" />
                                    {task.consultant}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </aside>
          </div>
        </motion.section>
      </div>
    </div>
  );
}

function BadgeInfo({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-center">
      <p className={`text-sm font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
