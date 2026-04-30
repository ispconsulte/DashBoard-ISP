import { motion } from "framer-motion";
import { Target } from "lucide-react";

type Props = {
  done: number;
  total: number;
  activeProjects: number;
  totalHours: number;
};

export default function AnalyticsCompletionGauge({ done, total, activeProjects, totalHours }: Props) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // SVG gauge params
  const size = 180;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const arc = circumference * 0.75; // 270 degrees
  const offset = arc - (arc * pct) / 100;
  const rotation = 135; // start from bottom-left

  const stats = [
    { label: "Concluídas", value: done.toLocaleString("pt-BR") },
    { label: "Projetos", value: activeProjects.toLocaleString("pt-BR") },
    { label: "Horas", value: totalHours >= 1 ? `${Math.round(totalHours)}h` : totalHours > 0 ? `${Math.round(totalHours * 60)}min` : "0min" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25 }}
      className="rounded-2xl border border-white/[0.06] p-6 transition-all hover:border-white/[0.10] flex flex-col items-center"
      style={{ background: "linear-gradient(145deg, hsl(270 50% 14% / 0.8), hsl(234 45% 10% / 0.6))" }}
    >
      <div className="flex items-center gap-2 self-start mb-2">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: "hsl(160 84% 39% / 0.15)" }}
        >
          <Target className="h-4 w-4" style={{ color: "hsl(160 84% 39%)" }} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white/90">Meta de Conclusão</h3>
          <p className="text-[10px] text-white/30">{done}/{total} tarefas concluídas</p>
        </div>
      </div>

      {/* Gauge */}
      <div className="relative my-4">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(270 20% 15%)"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arc} ${circumference}`}
            strokeLinecap="round"
            transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
          />
          {/* Foreground arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arc} ${circumference}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
          />
          <defs>
            <linearGradient id="gaugeGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="hsl(262 83% 58%)" />
              <stop offset="100%" stopColor="hsl(160 84% 39%)" />
            </linearGradient>
          </defs>
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-4xl font-black text-white/90"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            {pct}%
          </motion.span>
          <span className="text-[10px] text-white/30 mt-0.5">concluído</span>
        </div>
      </div>

      {/* Bottom stats */}
      <div className="grid grid-cols-3 gap-3 w-full mt-2">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 + i * 0.1 }}
            className="text-center rounded-xl border border-white/[0.04] bg-white/[0.02] py-2.5 px-2"
          >
            <p className="text-lg font-bold text-white/80">{s.value}</p>
            <p className="text-[9px] text-white/30">{s.label}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
