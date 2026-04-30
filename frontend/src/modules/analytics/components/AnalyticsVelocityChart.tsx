import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Info, X } from "lucide-react";
import type { TaskRecord } from "@/modules/tasks/types";

type Props = {
  tasks: TaskRecord[];
  classifyTask: (t: TaskRecord) => "done" | "overdue" | "pending";
};

const WEEKS = 12;

export default function AnalyticsVelocityChart({ tasks, classifyTask }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  const { weekData, avgVelocity, trend } = useMemo(() => {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - WEEKS * 7);

    const weeks: { label: string; count: number; startDate: Date }[] = [];
    for (let w = 0; w < WEEKS; w++) {
      const ws = new Date(startDate);
      ws.setDate(ws.getDate() + w * 7);
      weeks.push({
        label: ws.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
        count: 0,
        startDate: ws,
      });
    }

    const doneTasks = tasks.filter((t) => classifyTask(t) === "done");
    doneTasks.forEach((t) => {
      const raw = t.deadline ?? t.due_date ?? t.dueDate ?? t.created_at ?? t.createdAt;
      if (!raw) return;
      const d = new Date(String(raw));
      if (Number.isNaN(d.getTime())) return;
      if (d < startDate || d > now) return;

      const diffMs = d.getTime() - startDate.getTime();
      const weekIdx = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
      if (weekIdx >= 0 && weekIdx < WEEKS) {
        weeks[weekIdx].count++;
      }
    });

    const avg = weeks.reduce((s, w) => s + w.count, 0) / WEEKS;

    const firstHalf = weeks.slice(0, Math.floor(WEEKS / 2)).reduce((s, w) => s + w.count, 0);
    const secondHalf = weeks.slice(Math.floor(WEEKS / 2)).reduce((s, w) => s + w.count, 0);
    const trend: "up" | "down" | "flat" = secondHalf > firstHalf * 1.15 ? "up" : secondHalf < firstHalf * 0.85 ? "down" : "flat";

    return { weekData: weeks, avgVelocity: avg, trend };
  }, [tasks, classifyTask]);

  const maxCount = Math.max(...weekData.map((w) => w.count), 1);

  const chartW = 380;
  const chartH = 100;
  const padX = 10;
  const padY = 10;
  const usableW = chartW - padX * 2;

  const points = weekData.map((w, i) => ({
    x: padX + (i / (WEEKS - 1)) * usableW,
    y: padY + (1 - w.count / maxCount) * (chartH - padY * 2),
  }));

  const buildPath = () => {
    if (points.length < 2) return "";
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx1 = prev.x + (curr.x - prev.x) * 0.4;
      const cpx2 = curr.x - (curr.x - prev.x) * 0.4;
      d += ` C ${cpx1} ${prev.y}, ${cpx2} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    return d;
  };

  const linePath = buildPath();
  const areaPath = linePath + ` L ${points[points.length - 1].x} ${chartH} L ${points[0].x} ${chartH} Z`;
  const avgY = padY + (1 - avgVelocity / maxCount) * (chartH - padY * 2);

  const trendConfig = {
    up: { label: "Acelerando", color: "hsl(160 84% 39%)", emoji: "🚀" },
    down: { label: "Desacelerando", color: "hsl(0 84% 60%)", emoji: "📉" },
    flat: { label: "Estável", color: "hsl(200 80% 55%)", emoji: "➡️" },
  };

  const tc = trendConfig[trend];
  const hoveredData = hoveredIdx !== null ? weekData[hoveredIdx] : null;
  const chartKey = useMemo(() => weekData.map((w) => w.count).join("|"), [weekData]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.35 }}
      className="rounded-2xl border border-white/[0.06] p-6 transition-all hover:border-white/[0.10] relative"
      style={{ background: "linear-gradient(145deg, hsl(270 50% 14% / 0.8), hsl(234 45% 10% / 0.6))" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <motion.div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: "hsl(160 84% 39% / 0.15)" }}
            animate={{
              scale: [1, 1.15, 1],
              boxShadow: [
                "0 0 0px hsl(160 84% 39% / 0)",
                "0 0 12px hsl(160 84% 39% / 0.4)",
                "0 0 0px hsl(160 84% 39% / 0)",
              ],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <motion.div
              animate={{ x: [0, 2, 0, -2, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
            >
              <Zap className="h-4 w-4" style={{ color: "hsl(160 84% 39%)" }} />
            </motion.div>
          </motion.div>
          <div>
            <h3 className="text-sm font-bold text-white/90">Velocidade de Entrega</h3>
            <p className="text-[10px] text-white/30">Tarefas concluídas por semana</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mr-9">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ color: tc.color, background: `${tc.color.replace(")", " / 0.15)")}` }}
          >
            {tc.emoji} {tc.label}
          </span>
        </div>
      </div>

      {/* Info button — top right corner */}
      <button
        onClick={() => setShowInfo(true)}
        className="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-lg text-white/25 hover:text-white/60 hover:bg-white/[0.08] transition-all"
      >
        <Info className="h-4 w-4" />
      </button>

      {/* Info Modal */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0 z-20 flex flex-col overflow-hidden rounded-2xl"
            style={{ background: "hsl(260 30% 10% / 0.97)", backdropFilter: "blur(8px)" }}
          >
            <div className="flex-1 overflow-y-auto p-5 styled-scrollbar">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-white/90">Sobre este gráfico</h4>
                <button onClick={() => setShowInfo(false)} className="flex h-7 w-7 items-center justify-center rounded-lg text-white/50 hover:text-white/90 hover:bg-white/10 transition">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2.5 text-[11px] text-white/60 leading-relaxed">
                <p>A <strong className="text-white/80">Velocidade de Entrega</strong> acompanha o volume de tarefas concluídas por semana nas últimas <strong className="text-white/80">{WEEKS} semanas</strong>.</p>
                <p className="text-white/50">Este gráfico ajuda a identificar se a equipe está acelerando, desacelerando ou mantendo um ritmo estável de entregas.</p>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3 space-y-2">
                  <p className="text-[10px] font-bold text-white/70 uppercase tracking-wider mb-1">Legenda</p>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-6 rounded-full shrink-0" style={{ background: "linear-gradient(90deg, hsl(234 89% 64%), hsl(160 84% 39%))" }} />
                    <span><strong className="text-white/80">Linha gradiente:</strong> tarefas concluídas por semana</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-px w-6 border-t border-dashed shrink-0" style={{ borderColor: "hsl(262 83% 58% / 0.6)" }} />
                    <span><strong className="text-white/80">Linha tracejada:</strong> média de entregas no período</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm shrink-0">🚀</span>
                    <span><strong className="text-white/80">Indicador:</strong> compara as últimas 6 semanas com as 6 anteriores</span>
                  </div>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3 space-y-1.5">
                  <p className="text-[10px] font-bold text-white/70 uppercase tracking-wider mb-1">Resumo do período</p>
                  <div className="flex items-center justify-between">
                    <span className="text-white/50">Média semanal</span>
                    <span className="font-bold text-white/80">{avgVelocity.toFixed(1)} tarefas</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/50">Melhor semana</span>
                    <span className="font-bold text-emerald-400">{maxCount} tarefas</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/50">Total entregue</span>
                    <span className="font-bold text-white/80">{weekData.reduce((s, w) => s + w.count, 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/50">Tendência</span>
                    <span className="font-bold" style={{ color: tc.color }}>{tc.emoji} {tc.label}</span>
                  </div>
                </div>
                <p className="text-white/40 italic">💡 Passe o mouse nos pontos do gráfico para ver o total de cada semana.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chart */}
      <div className="relative">
        {/* Floating tooltip */}
        <AnimatePresence>
          {hoveredData && hoveredIdx !== null && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              className="absolute z-10 pointer-events-none rounded-xl border border-white/[0.08] px-3 py-2 shadow-xl"
              style={{
                background: "hsl(260 30% 12% / 0.95)",
                backdropFilter: "blur(8px)",
                left: hoveredIdx > WEEKS * 0.7
                  ? `${Math.max((hoveredIdx / (WEEKS - 1)) * 100 - 2, 5)}%`
                  : `${Math.min((hoveredIdx / (WEEKS - 1)) * 100 + 2, 95)}%`,
                top: -8,
                transform: hoveredIdx > WEEKS * 0.7 ? "translateX(-100%)" : "translateX(0%)",
              }}
            >
              <p className="text-[11px] font-bold text-white/80 mb-0.5">{hoveredData.label}</p>
              <span className="text-[10px] text-white/60">{hoveredData.count} tarefa{hoveredData.count !== 1 ? "s" : ""} concluída{hoveredData.count !== 1 ? "s" : ""}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <svg key={chartKey} width="100%" viewBox={`0 0 ${chartW} ${chartH + 24}`} preserveAspectRatio="xMidYMid meet" className="overflow-visible">
          {/* Area fill */}
          <motion.path
            d={areaPath}
            fill="url(#velocityFill)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          />

          {/* Line */}
          <motion.path
            d={linePath}
            fill="none"
            stroke="url(#velocityStroke)"
            strokeWidth={2.5}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.3, duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
          />

          {/* Average line */}
          <line
            x1={0}
            y1={avgY}
            x2={chartW}
            y2={avgY}
            stroke="hsl(262 83% 58% / 0.4)"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          <rect x={chartW - 95} y={avgY - 17} width={93} height={16} rx={5} fill="hsl(260 30% 12% / 0.9)" stroke="hsl(262 83% 58% / 0.15)" strokeWidth={0.5} />
          <text x={chartW - 4} y={avgY - 6} textAnchor="end" className="fill-white/60 font-semibold" style={{ fontSize: "10px" }}>
            média {avgVelocity.toFixed(1)}/sem
          </text>

          {/* Data points — all weeks visible with hover */}
          {points.map((p, i) => {
            const w = weekData[i];
            const isLast = i === points.length - 1;
            const isHovered = hoveredIdx === i;
            return (
              <g
                key={i}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Hover target */}
                <rect x={p.x - 14} y={padY - 5} width={28} height={chartH + 5} fill="transparent" />
                {/* Hover highlight line */}
                {isHovered && (
                  <line x1={p.x} y1={padY} x2={p.x} y2={chartH} stroke="hsl(262 83% 58% / 0.2)" strokeWidth={1} strokeDasharray="3 3" />
                )}
                {/* Dot */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 6 : isLast ? 4.5 : 3.5}
                  fill={isHovered ? "white" : "hsl(262 83% 58%)"}
                  stroke={isHovered ? "hsl(262 83% 58%)" : "hsl(270 50% 12%)"}
                  strokeWidth={2}
                  style={{ transition: "all 0.15s ease" }}
                />
                {/* Pulse on last point */}
                {isLast && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={8}
                    fill="none"
                    stroke="hsl(262 83% 58% / 0.2)"
                    strokeWidth={1}
                  />
                )}
                {/* Value label on recent */}
                {w.count > 0 && i >= WEEKS - 3 && !isHovered && (
                  <text x={p.x} y={p.y - 10} textAnchor="middle" className="fill-white/50 font-bold" style={{ fontSize: "9px" }}>
                    {w.count}
                  </text>
                )}
              </g>
            );
          })}

          {/* Week labels — every 3rd to avoid overlap */}
          {weekData.map((w, i) => {
            if (i % 3 !== 0 && i !== WEEKS - 1) return null;
            const x = points[i].x;
            return (
              <text
                key={i}
                x={i === 0 ? Math.max(x, padX + 5) : i === WEEKS - 1 ? Math.min(x, chartW - padX - 5) : x}
                y={chartH + 18}
                textAnchor={i === 0 ? "start" : i === WEEKS - 1 ? "end" : "middle"}
                className="fill-white/45 font-medium"
                style={{ fontSize: "9px" }}
              >
                {w.label}
              </text>
            );
          })}

          <defs>
            <linearGradient id="velocityStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="hsl(234 89% 64%)" />
              <stop offset="100%" stopColor="hsl(160 84% 39%)" />
            </linearGradient>
            <linearGradient id="velocityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(262 83% 58% / 0.2)" />
              <stop offset="100%" stopColor="hsl(262 83% 58% / 0)" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Bottom stats */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          { label: "Média/semana", value: avgVelocity.toFixed(1) },
          { label: "Melhor semana", value: maxCount.toString() },
          { label: "Total entregue", value: weekData.reduce((s, w) => s + w.count, 0).toString() },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 + i * 0.1 }}
            className="rounded-xl border border-white/[0.04] bg-white/[0.02] py-2 px-2 text-center"
          >
            <p className="text-sm font-bold text-white/80">{s.value}</p>
            <p className="text-[8px] text-white/25">{s.label}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
