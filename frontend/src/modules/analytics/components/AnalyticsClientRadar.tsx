import { useMemo } from "react";
import { motion } from "framer-motion";
import { Radar } from "lucide-react";
import type { ProjectAnalytics } from "../types";

type Props = {
  projects: ProjectAnalytics[];
};

const MAX_AXES = 6;

export default function AnalyticsClientRadar({ projects }: Props) {
  const clientData = useMemo(() => {
    const map = new Map<string, number>();
    projects.forEach((p) => {
      const name = p.clientName || `Cliente ${p.clientId || "?"}`;
      map.set(name, (map.get(name) ?? 0) + p.hoursUsed);
    });
    return [...map.entries()]
      .map(([name, hours]) => ({ name, hours }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, MAX_AXES);
  }, [projects]);

  const maxHours = useMemo(() => Math.max(...clientData.map((d) => d.hours), 1), [clientData]);
  const totalHours = useMemo(() => clientData.reduce((s, d) => s + d.hours, 0), [clientData]);

  const n = clientData.length;

  // Concentration score: how concentrated the hours are (0 = equal, 100 = all in one)
  const concentration = useMemo(() => {
    if (totalHours === 0 || n < 2) return 0;
    const shares = clientData.map((d) => d.hours / totalHours);
    const hhi = shares.reduce((s, p) => s + p * p, 0);
    return Math.round(((hhi - 1 / n) / (1 - 1 / n)) * 100);
  }, [clientData, totalHours, n]);

  // SVG radar params
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 85;
  const levels = 4;

  const getPoint = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2;
    const r = (value / maxHours) * maxR;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  };

  const polygonPoints = clientData.map((d, i) => {
    const p = getPoint(i, d.hours);
    return `${p.x},${p.y}`;
  }).join(" ");

  if (n < 3) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="rounded-2xl border border-white/[0.06] p-6 flex items-center justify-center"
        style={{ background: "linear-gradient(145deg, hsl(270 50% 14% / 0.8), hsl(234 45% 10% / 0.6))" }}
      >
        <p className="text-xs text-white/30">Necessário 3+ clientes para o radar</p>
      </motion.div>
    );
  }

  const concentrationLabel = concentration > 70 ? "Muito concentrado" : concentration > 40 ? "Moderado" : "Diversificado";
  const concentrationColor = concentration > 70 ? "hsl(0 84% 60%)" : concentration > 40 ? "hsl(45 100% 55%)" : "hsl(160 84% 39%)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="rounded-2xl border border-white/[0.06] p-6 transition-all hover:border-white/[0.10] flex flex-col items-center"
      style={{ background: "linear-gradient(145deg, hsl(270 50% 14% / 0.8), hsl(234 45% 10% / 0.6))" }}
    >
      <div className="flex items-center gap-2 self-start mb-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "hsl(200 80% 55% / 0.15)" }}>
          <Radar className="h-4 w-4" style={{ color: "hsl(200 80% 55%)" }} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white/90">Distribuição por Cliente</h3>
          <p className="text-[10px] text-white/30">Onde seu tempo está investido</p>
        </div>
      </div>

      {/* Radar SVG */}
      <div className="relative my-2">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Grid levels */}
          {Array.from({ length: levels }, (_, l) => {
            const r = maxR * ((l + 1) / levels);
            const points = Array.from({ length: n }, (_, i) => {
              const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
              return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
            }).join(" ");
            return (
              <polygon
                key={l}
                points={points}
                fill="none"
                stroke="hsl(262 30% 30% / 0.3)"
                strokeWidth={0.5}
              />
            );
          })}

          {/* Axis lines */}
          {clientData.map((_, i) => {
            const p = getPoint(i, maxHours);
            return (
              <line
                key={i}
                x1={cx}
                y1={cy}
                x2={p.x}
                y2={p.y}
                stroke="hsl(262 30% 30% / 0.2)"
                strokeWidth={0.5}
              />
            );
          })}

          {/* Data polygon */}
          <motion.polygon
            points={polygonPoints}
            fill="url(#radarFill)"
            stroke="hsl(262 83% 58%)"
            strokeWidth={2}
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: `${cx}px ${cy}px` }}
          />

          {/* Data points */}
          {clientData.map((d, i) => {
            const p = getPoint(i, d.hours);
            return (
              <motion.circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={4}
                fill="hsl(262 83% 58%)"
                stroke="hsl(270 50% 12%)"
                strokeWidth={2}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.7 + i * 0.08 }}
              />
            );
          })}

          {/* Labels */}
          {clientData.map((d, i) => {
            const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
            const labelR = maxR + 18;
            const x = cx + labelR * Math.cos(angle);
            const y = cy + labelR * Math.sin(angle);
            const truncName = d.name.length > 12 ? d.name.slice(0, 11) + "…" : d.name;
            return (
              <text
                key={i}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-[8px] fill-white/40"
              >
                {truncName}
              </text>
            );
          })}

          <defs>
            <radialGradient id="radarFill" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="hsl(262 83% 58% / 0.3)" />
              <stop offset="100%" stopColor="hsl(234 89% 64% / 0.1)" />
            </radialGradient>
          </defs>
        </svg>
      </div>

      {/* Concentration indicator */}
      <div className="flex items-center gap-2 mt-1">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{ color: concentrationColor, background: `${concentrationColor.replace(")", " / 0.15)")}` }}
        >
          {concentrationLabel}
        </span>
        <span className="text-[9px] text-white/25">{concentration}% concentração</span>
      </div>
    </motion.div>
  );
}
