import { useMemo } from "react";
import { dateToLocalIso, todayLocalIso, formatTimestampPtBr, getElapsedEffectiveDate } from "@/modules/tasks/utils";
import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import type { ElapsedTimeRecord } from "@/modules/tasks/types";

type Props = {
  times: ElapsedTimeRecord[];
};

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKS = 16;

function getIntensity(hours: number): number {
  if (hours === 0) return 0;
  if (hours < 0.5) return 1;
  if (hours < 2) return 2;
  if (hours < 5) return 3;
  return 4;
}

const INTENSITY_COLORS = [
  "hsl(234 30% 12%)",        // 0 - empty
  "hsl(262 60% 25%)",        // 1 - low
  "hsl(262 70% 40%)",        // 2 - medium
  "hsl(262 83% 55%)",        // 3 - high
  "hsl(262 90% 68%)",        // 4 - very high
];

export default function AnalyticsActivityHeatmap({ times }: Props) {
  const { grid, maxHours, totalActiveDays, peakDay } = useMemo(() => {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - WEEKS * 7);

    // Build day → hours map
    const dayMap = new Map<string, number>();
    times.forEach((t) => {
      const d = getElapsedEffectiveDate(t);
      if (!d) return;
      const key = dateToLocalIso(d);
      dayMap.set(key, (dayMap.get(key) ?? 0) + (t.seconds ?? 0) / 3600);
    });

    // Build grid: weeks × days
    const grid: { date: string; hours: number; dayOfWeek: number; weekIndex: number }[] = [];
    let maxH = 0;
    let activeDays = 0;
    let peak = { date: "", hours: 0 };

    for (let w = 0; w < WEEKS; w++) {
      for (let d = 0; d < 7; d++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + w * 7 + d);
        const key = dateToLocalIso(date);
        const hours = dayMap.get(key) ?? 0;
        if (hours > 0) activeDays++;
        if (hours > maxH) {
          maxH = hours;
          peak = { date: key, hours };
        }
        grid.push({ date: key, hours, dayOfWeek: d, weekIndex: w });
      }
    }

    return { grid, maxHours: maxH, totalActiveDays: activeDays, peakDay: peak };
  }, [times]);

  const peakLabel = peakDay.date
    ? formatTimestampPtBr(peakDay.date, { day: "2-digit", month: "short" })
    : "—";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25 }}
      className="rounded-2xl border border-white/[0.06] p-6 transition-all hover:border-white/[0.10]"
      style={{ background: "linear-gradient(145deg, hsl(270 50% 14% / 0.8), hsl(234 45% 10% / 0.6))" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "hsl(262 83% 58% / 0.15)" }}>
            <Flame className="h-4 w-4" style={{ color: "hsl(262 83% 58%)" }} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white/90">Atividade</h3>
            <p className="text-[10px] text-white/30">Últimas {WEEKS} semanas</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-white/80">{totalActiveDays} <span className="text-[10px] text-white/30 font-normal">dias ativos</span></p>
        </div>
      </div>

      {/* Heatmap grid */}
      <div className="flex gap-[3px] overflow-x-auto pb-1">
        {/* Day labels */}
        <div className="flex flex-col gap-[3px] shrink-0 pr-1">
          {DAYS.map((d, i) => (
            <div key={d} className="flex h-[14px] items-center">
              {i % 2 === 1 && <span className="text-[8px] text-white/20 leading-none">{d}</span>}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {Array.from({ length: WEEKS }, (_, w) => (
          <div key={w} className="flex flex-col gap-[3px]">
            {Array.from({ length: 7 }, (_, d) => {
              const cell = grid[w * 7 + d];
              if (!cell) return null;
              const intensity = getIntensity(cell.hours);
              const today = todayLocalIso();
              const isToday = cell.date === today;

              return (
                <motion.div
                  key={cell.date}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: w * 0.02 + d * 0.005, duration: 0.3 }}
                  className="group relative"
                >
                  <div
                    className={`h-[14px] w-[14px] rounded-[3px] transition-all duration-300 group-hover:scale-125 group-hover:brightness-125 ${isToday ? "ring-1 ring-primary/30" : ""}`}
                    style={{ background: INTENSITY_COLORS[intensity] }}
                  />
                  {/* Tooltip */}
                  <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap rounded-md bg-black/90 px-2 py-1 text-[9px] text-white/80 shadow-lg">
                    {cell.hours > 0 ? `${cell.hours.toFixed(1)}h` : "Sem atividade"} · {formatTimestampPtBr(cell.date, { day: "2-digit", month: "short" })}
                  </div>
                </motion.div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend + stats */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-white/20">Menos</span>
          {INTENSITY_COLORS.map((c, i) => (
            <div key={i} className="h-[10px] w-[10px] rounded-[2px]" style={{ background: c }} />
          ))}
          <span className="text-[9px] text-white/20">Mais</span>
        </div>
        {peakDay.hours > 0 && (
          <span className="text-[9px] text-white/25">
            Pico: <span className="font-bold text-white/50">{peakDay.hours.toFixed(1)}h</span> em {peakLabel}
          </span>
        )}
      </div>
    </motion.div>
  );
}
