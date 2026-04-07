// ── Sprint 6.0 — Variance Table (redesigned) ───────────────────────
import type { RoiProjectData } from "@/modules/sprint6/types";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  projects: RoiProjectData[];
}

function VarianceBadge({ value }: { value: number }) {
  if (value > 10) {
    return (
      <Badge variant="outline" className="text-[10px] bg-rose-500/15 text-rose-400 border-rose-500/20 px-1.5 py-0">
        +{value}%
      </Badge>
    );
  }
  if (value < -10) {
    return (
      <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/20 px-1.5 py-0">
        {value}%
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] bg-white/[0.04] text-white/50 border-white/10 px-1.5 py-0">
      {value > 0 ? "+" : ""}{value}%
    </Badge>
  );
}

export function RoiVarianceTable({ projects }: Props) {
  const isMobile = useIsMobile();
  const sorted = [...projects]
    .filter((p) => p.hoursContracted > 0 || p.hoursUsed > 0)
    .sort((a, b) => b.variancePercent - a.variancePercent);

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
        Não encontrado
      </div>
    );
  }

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      {/* Header */}
      <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-2 text-[10px] font-semibold text-white/30 uppercase tracking-wider border-b border-border/8">
        <div className="col-span-4">Projeto</div>
        <div className="col-span-2 text-center">Orçadas</div>
        <div className="col-span-2 text-center">Realizadas</div>
        <div className="col-span-2 text-center">Variância</div>
        <div className="col-span-2 text-center">ROI</div>
      </div>

      {sorted.map((p, i) => (
        <motion.div
          key={p.projectId}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.025, duration: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-12 gap-1 sm:gap-2 px-4 py-2.5 border-b border-border/6 last:border-b-0 hover:bg-white/[0.02] transition-colors"
        >
          {/* Project name */}
          <div className="sm:col-span-4 min-w-0">
            <p className="text-xs font-medium text-white/80 truncate">{p.projectName}</p>
          </div>

          {/* Mobile inline */}
          <div className="sm:hidden flex items-center gap-3 text-[11px] text-white/50">
            <span>{p.hoursContracted}h orç.</span>
            <span>{Math.round(p.hoursUsed * 10) / 10}h real.</span>
            <VarianceBadge value={p.variancePercent} />
            {p.roiPercent != null && (
              <span className={p.roiPercent > 0 ? "text-emerald-400" : p.roiPercent < 0 ? "text-rose-400" : "text-white/40"}>
                ROI {p.roiPercent > 0 ? "+" : ""}{p.roiPercent}%
              </span>
            )}
          </div>

          {/* Desktop columns */}
          <div className="hidden sm:flex sm:col-span-2 items-center justify-center text-xs text-white/50">
            {p.hoursContracted}h
          </div>
          <div className="hidden sm:flex sm:col-span-2 items-center justify-center text-xs text-white/50">
            {Math.round(p.hoursUsed * 10) / 10}h
          </div>
          <div className="hidden sm:flex sm:col-span-2 items-center justify-center">
            <VarianceBadge value={p.variancePercent} />
          </div>
          <div className="hidden sm:flex sm:col-span-2 items-center justify-center text-xs">
            {p.roiPercent != null ? (
              <span
                className={
                  p.roiPercent > 0
                    ? "text-emerald-400 font-medium"
                    : p.roiPercent < 0
                    ? "text-rose-400 font-medium"
                    : "text-white/40"
                }
              >
                {p.roiPercent > 0 ? "+" : ""}{p.roiPercent}%
              </span>
            ) : (
              <span className="text-white/20">Não encontrado</span>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
