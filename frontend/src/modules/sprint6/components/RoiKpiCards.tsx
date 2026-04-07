// ── Sprint 6.0 — ROI KPI Cards ─────────────────────────────────────
import { motion } from "framer-motion";
import { Clock, TrendingUp, TrendingDown, BarChart3, DollarSign } from "lucide-react";
import type { RoiSummary } from "@/modules/sprint6/types";

interface Props {
  summary: RoiSummary;
  hasFinancials?: boolean;
}

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

export function RoiKpiCards({ summary, hasFinancials }: Props) {
  // Average ROI across projects that have it
  const roiProjects = summary.projects.filter((p) => p.roiPercent != null);
  const avgRoi = roiProjects.length
    ? Math.round((roiProjects.reduce((s, p) => s + (p.roiPercent ?? 0), 0) / roiProjects.length) * 10) / 10
    : null;

  const kpis = [
    {
      label: "Horas Orçadas",
      value: `${Math.round(summary.totalContracted)}h`,
      icon: Clock,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: "Horas Realizadas",
      value: `${Math.round(summary.totalUsed)}h`,
      icon: BarChart3,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: "Variância Geral",
      value: `${summary.overallVariance > 0 ? "+" : ""}${summary.overallVariance}%`,
      icon: summary.overallVariance > 0 ? TrendingUp : TrendingDown,
      color: summary.overallVariance > 10
        ? "text-destructive"
        : summary.overallVariance < -10
        ? "text-green-400"
        : "text-muted-foreground",
      bgColor: summary.overallVariance > 10
        ? "bg-destructive/10"
        : summary.overallVariance < -10
        ? "bg-green-500/10"
        : "bg-muted/30",
    },
    {
      label: "ROI Médio",
      value: hasFinancials && avgRoi != null ? `${avgRoi > 0 ? "+" : ""}${avgRoi}%` : "—",
      icon: DollarSign,
      color: avgRoi != null && avgRoi > 0
        ? "text-green-400"
        : avgRoi != null && avgRoi < 0
        ? "text-destructive"
        : "text-muted-foreground",
      bgColor: avgRoi != null && avgRoi > 0
        ? "bg-green-500/10"
        : avgRoi != null && avgRoi < 0
        ? "bg-destructive/10"
        : "bg-muted/30",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {kpis.map((kpi, i) => (
        <motion.div
          key={kpi.label}
          variants={fadeUp}
          transition={{ duration: 0.35, delay: i * 0.05 }}
          className="rounded-2xl border border-border/15 bg-card/50 backdrop-blur-sm p-4 space-y-2 transition-all duration-200 hover:bg-card/70"
        >
          <div className="flex items-center gap-2">
            <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${kpi.bgColor}`}>
              <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
            </div>
            <span className="text-[11px] font-medium text-muted-foreground">{kpi.label}</span>
          </div>
          <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
        </motion.div>
      ))}
    </div>
  );
}
