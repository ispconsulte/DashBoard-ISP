import { useMemo, useState } from "react";
import { Timer, User, Clock, BarChart3, CircleDot, Info, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { ElapsedTimeRecord } from "@/modules/tasks/types";
import { formatDurationHHMM, durationColorClass, getElapsedEffectiveDate } from "@/modules/tasks/utils";

type TimeTrackingSectionProps = {
  entries: ElapsedTimeRecord[];
  totalSeconds?: number;
  /** Map of user_id → display name (from tasks responsible_id/responsible_name) */
  userNames?: Record<string, string>;
};

const formatDateTime = (raw?: string | Date | null): string | null => {
  if (!raw) return null;
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getEntryStartDate = (entry: ElapsedTimeRecord): Date | null =>
  getElapsedEffectiveDate(entry);

const getEntryStopDate = (entry: ElapsedTimeRecord): Date | null => {
  const explicitStop = entry.date_stop ? new Date(String(entry.date_stop)) : null;
  if (explicitStop && !Number.isNaN(explicitStop.getTime())) {
    return explicitStop;
  }

  const start = getEntryStartDate(entry);
  const seconds = typeof entry.seconds === "number" ? entry.seconds : Number(entry.seconds ?? 0);
  if (!start || !Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  return new Date(start.getTime() + seconds * 1000);
};

const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Generates a consistent color from user_id for avatar */
const userColor = (userId?: string | number | null): string => {
  if (!userId) return "hsl(var(--task-purple))";
  const colors = [
    "hsl(160 84% 39%)",
    "hsl(var(--task-purple))",
    "hsl(var(--task-yellow))",
    "hsl(210 80% 55%)",
    "hsl(330 70% 55%)",
    "hsl(25 90% 55%)",
  ];
  const hash = String(userId).split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

/** Get first name + second name (not last) from a full name */
const getDisplayName = (fullName: string | null): string | null => {
  if (!fullName) return null;
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length <= 2) return parts.join(" ");
  return `${parts[0]} ${parts[1]}`;
};

/** Mini daily activity sparkline for the last 7 days */
function DailyActivityBars({ entries }: { entries: ElapsedTimeRecord[] }) {
  const dailyData = useMemo(() => {
    const now = new Date();
    const days: { label: string; seconds: number; isToday: boolean }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      // Use local date string (YYYY-MM-DD) for comparison to avoid timezone mismatches
      const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      let totalSec = 0;
      entries.forEach((entry) => {
        // Try multiple date fields to find the effective date for this entry
        const effective = getElapsedEffectiveDate(entry);
        const stopDate = entry.date_stop ? new Date(String(entry.date_stop)) : null;
        const entryDate = effective ?? (stopDate && !Number.isNaN(stopDate.getTime()) ? stopDate : null);
        if (!entryDate) return;
        // Compare using local date string to avoid UTC vs local mismatch
        const entryKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, "0")}-${String(entryDate.getDate()).padStart(2, "0")}`;
        if (entryKey === dayKey) {
          totalSec += typeof entry.seconds === "number" ? entry.seconds : Number(entry.seconds ?? 0);
        }
      });

      days.push({
        label: WEEKDAYS_SHORT[d.getDay()],
        seconds: totalSec,
        isToday: i === 0,
      });
    }
    return days;
  }, [entries]);

  const maxSec = Math.max(1, ...dailyData.map((d) => d.seconds));
  const hasActivity = dailyData.some((d) => d.seconds > 0);

  if (!hasActivity) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-xl border border-[hsl(var(--task-border))] bg-gradient-to-br from-[hsl(var(--task-surface))] to-[hsl(var(--task-bg))] p-4 mb-3"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center justify-center h-5 w-5 rounded-md bg-[hsl(var(--task-purple)/0.15)]">
          <BarChart3 className="h-3 w-3 text-[hsl(var(--task-purple))]" />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--task-text-muted))]">
          Atividade dos Últimos 7 Dias
        </span>
      </div>
      <div className="flex items-end gap-2 h-14">
        {dailyData.map((day, i) => {
          const pct = day.seconds > 0 ? Math.max(10, (day.seconds / maxSec) * 100) : 0;
          const color = durationColorClass(day.seconds);
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full relative" style={{ height: 40 }}>
                {day.seconds > 0 ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: `${pct}%`, opacity: 1 }}
                    transition={{ duration: 0.6, delay: i * 0.07, ease: "easeOut" }}
                    className="absolute bottom-0 left-[15%] right-[15%] rounded-md"
                    style={{
                      background: day.isToday
                        ? "linear-gradient(to top, hsl(160 84% 32%), hsl(160 84% 45%))"
                        : `linear-gradient(to top, ${color.accent}cc, ${color.accent})`,
                      boxShadow: day.isToday ? "0 0 8px hsl(160 84% 39% / 0.4)" : undefined,
                    }}
                    title={formatDurationHHMM(day.seconds)}
                  />
                ) : (
                  <div className="absolute bottom-0 left-[25%] right-[25%] h-[3px] rounded-full bg-[hsl(var(--task-border)/0.5)]" />
                )}
              </div>
              <span className={`text-[9px] font-semibold ${day.isToday ? "text-emerald-400" : "text-[hsl(var(--task-text-muted))]"}`}>
                {day.label}
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

export function TimeTrackingSection({ entries, totalSeconds, userNames }: TimeTrackingSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  const sorted = [...entries].sort((a, b) => {
    const da = getEntryStartDate(a)?.getTime() ?? 0;
    const db = getEntryStartDate(b)?.getTime() ?? 0;
    return db - da;
  });

  const uniqueUsers = new Set(entries.map((e) => e.user_id).filter(Boolean));
  const totalColor = durationColorClass(totalSeconds);

  return (
    <div className="space-y-0 mb-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="rounded-xl border border-[hsl(var(--task-border))] bg-gradient-to-br from-[hsl(var(--task-surface))] to-[hsl(var(--task-bg))] overflow-hidden"
      >
        {/* Clickable Header */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-4 hover:bg-[hsl(var(--task-surface-hover))] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-5 w-5 rounded-md bg-[hsl(var(--task-purple)/0.15)]">
              <motion.div
                animate={{ rotate: isOpen ? 360 : 0 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
              >
                <Timer className="h-3 w-3 text-[hsl(var(--task-purple))]" />
              </motion.div>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--task-text-muted))]">
              Rastreamento de Tempo
            </span>
            <span className="text-[9px] text-[hsl(var(--task-text-muted))] bg-[hsl(var(--task-bg))] rounded-full px-2 py-0.5 border border-[hsl(var(--task-border))]">
              {entries.length} {entries.length === 1 ? "registro" : "registros"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {uniqueUsers.size > 0 && (
              <div className="flex items-center gap-1.5 bg-[hsl(var(--task-bg))] rounded-full px-2 py-0.5 border border-[hsl(var(--task-border))]">
                <User className="h-3 w-3 text-[hsl(var(--task-text-muted))]" />
                <span className="text-[10px] text-[hsl(var(--task-text-muted))]">
                  {uniqueUsers.size} {uniqueUsers.size === 1 ? "participante" : "participantes"}
                </span>
              </div>
            )}
            {totalSeconds != null && totalSeconds > 0 && (
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className={`flex items-center gap-1.5 rounded-lg ${totalColor.bg} px-2.5 py-1 border ${totalColor.border}`}
                style={{ boxShadow: `0 0 12px ${totalColor.accent}33` }}
              >
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Clock className={`h-3.5 w-3.5 ${totalColor.text}`} />
                </motion.div>
                <span className={`text-[11px] font-bold font-mono ${totalColor.text}`}>
                  {formatDurationHHMM(totalSeconds)}
                </span>
              </motion.div>
            )}
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="h-4 w-4 text-[hsl(var(--task-text-muted))]" />
            </motion.div>
          </div>
        </button>

        {/* Collapsible Content */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-3">
                {/* Color legend inside the card */}
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[hsl(var(--task-border)/0.3)] bg-[hsl(var(--task-bg)/0.5)] px-3 py-1.5">
                  <div className="flex items-center gap-1">
                    <Info className="h-3 w-3 text-[hsl(var(--task-text-muted))]" />
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-[hsl(var(--task-text-muted))]">Cores:</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span className="text-[10px] text-[hsl(var(--task-text-muted))]">&lt; 1h (rápido)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[hsl(var(--task-yellow))]" />
                    <span className="text-[10px] text-[hsl(var(--task-text-muted))]">1h–4h (moderado)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-400" />
                    <span className="text-[10px] text-[hsl(var(--task-text-muted))]">&gt; 4h (extenso)</span>
                  </div>
                </div>

                {/* Daily activity bars */}
                <DailyActivityBars entries={entries} />

                {/* Time entries list */}
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                  {sorted.map((entry, i) => {
                    const seconds = typeof entry.seconds === "number" ? entry.seconds : Number(entry.seconds ?? 0);
                    const entryDuration = formatDurationHHMM(seconds);
                    const entryColor = durationColorClass(seconds);
                    const avatarColor = userColor(entry.user_id);
                    const startDate = formatDateTime(getEntryStartDate(entry));
                    const stopDate = formatDateTime(getEntryStopDate(entry));
                    const effectiveDate = formatDateTime(getElapsedEffectiveDate(entry));
                    const hasRangeDate = startDate || stopDate;
                    const rawName = userNames?.[String(entry.user_id)] || null;
                    const displayName = getDisplayName(rawName);

                    return (
                      <motion.div
                        key={entry.id ?? (entry.task_id ? `${entry.task_id}-${i}` : i)}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3) }}
                        className="group flex items-center gap-3 rounded-lg bg-[hsl(var(--task-bg))] px-3 py-2.5 border border-[hsl(var(--task-border)/0.3)] hover:border-[hsl(var(--task-border))] transition-colors"
                      >
                        {/* Timeline dot */}
                        <div className="flex flex-col items-center gap-0.5">
                          <CircleDot className="h-3.5 w-3.5 text-emerald-400" />
                          {i < sorted.length - 1 && (
                            <div className="w-[1px] h-2 bg-[hsl(var(--task-border)/0.3)]" />
                          )}
                        </div>

                        {/* Main content: date + user name */}
                        <div className="min-w-0 flex-1">
                          {hasRangeDate ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              {startDate && (
                                <span className="text-[11px] font-medium text-[hsl(var(--task-text))]">
                                  {startDate}
                                </span>
                              )}
                              {startDate && stopDate && (
                                <span className="text-[10px] text-[hsl(var(--task-text-muted))]">→</span>
                              )}
                              {stopDate && (
                                <span className="text-[11px] text-[hsl(var(--task-text-muted))]">
                                  {stopDate}
                                </span>
                              )}
                            </div>
                          ) : effectiveDate ? (
                            <span className="text-[11px] font-medium text-[hsl(var(--task-text))]">
                              {effectiveDate}
                            </span>
                          ) : null}
                          {typeof entry.comment_text === "string" && entry.comment_text.trim() && (
                            <p className="text-[10px] text-[hsl(var(--task-text-muted))] truncate mt-0.5 italic max-w-[300px]">
                              {String(entry.comment_text)}
                            </p>
                          )}
                        </div>

                        {/* User badge */}
                        {entry.user_id && (() => {
                          return (
                            <div
                              className="flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold"
                              style={{
                                backgroundColor: `${avatarColor}22`,
                                color: avatarColor,
                                border: `1px solid ${avatarColor}44`,
                              }}
                              title={rawName || `Usuário #${entry.user_id}`}
                            >
                              <User className="h-3 w-3" />
                              {displayName && (
                                <span className="text-[10px] font-medium max-w-[120px] truncate">
                                  {displayName}
                                </span>
                              )}
                            </div>
                          );
                        })()}

                        {/* Duration badge */}
                        {entryDuration ? (
                          <div className={`flex items-center gap-1 rounded-md ${entryColor.bg} px-2 py-0.5 border ${entryColor.border}`}>
                            <span className={`text-[11px] font-bold font-mono whitespace-nowrap ${entryColor.text}`}>
                              {entryDuration}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-[hsl(var(--task-text-muted))] italic">Sem tempo</span>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
