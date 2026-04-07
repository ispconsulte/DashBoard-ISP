// ── Sprint 6.0 — Client Health: KPI Placeholder Cards ──────────────
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Users, Star } from "lucide-react";
import type { ClientHealthSummary } from "@/modules/sprint6/types";

interface Props {
  summary: ClientHealthSummary | null;
  notConfigured: boolean;
}

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

const KPI_SLOTS = [
  {
    key: "ebitda",
    label: "EBITDA Médio",
    icon: TrendingUp,
    format: (v: number | null) => (v != null ? `R$ ${v.toLocaleString("pt-BR")}` : "Não encontrado"),
    description: "Margem operacional média dos clientes",
  },
  {
    key: "churn",
    label: "Churn Rate",
    icon: TrendingDown,
    format: (v: number | null) => (v != null ? `${v.toFixed(1)}%` : "Não encontrado"),
    description: "Taxa de cancelamento no período",
  },
  {
    key: "nps",
    label: "NPS Médio",
    icon: Star,
    format: (v: number | null) => (v != null ? String(Math.round(v)) : "Não encontrado"),
    description: "Net Promoter Score agregado",
  },
  {
    key: "clients",
    label: "Clientes Monitorados",
    icon: Users,
    format: (_v: number | null, count?: number) => (count != null ? String(count) : "0"),
    description: "Total de clientes com KPIs cadastrados",
  },
] as const;

export function ClientHealthKpiCards({ summary, notConfigured }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {KPI_SLOTS.map((slot, i) => {
        const Icon = slot.icon;
        let value: string;

        if (notConfigured || !summary) {
          value = "Não encontrado";
        } else if (slot.key === "clients") {
          value = slot.format(null, summary.clients.length);
        } else if (slot.key === "ebitda") {
          const avg = summary.clients.length
            ? summary.clients.reduce((s, c) => s + (c.ebitda ?? 0), 0) / summary.clients.length
            : null;
          value = slot.format(avg);
        } else if (slot.key === "churn") {
          const avg = summary.clients.length
            ? summary.clients.reduce((s, c) => s + (c.churn ?? 0), 0) / summary.clients.length
            : null;
          value = slot.format(avg);
        } else {
          const avg = summary.clients.length
            ? summary.clients.reduce((s, c) => s + (c.nps ?? 0), 0) / summary.clients.length
            : null;
          value = slot.format(avg);
        }

        return (
          <motion.div
            key={slot.key}
            variants={fadeUp}
            transition={{ duration: 0.35, delay: i * 0.05 }}
            className="rounded-2xl border border-border/15 bg-card/50 backdrop-blur-sm p-4 space-y-2 transition-all duration-200 hover:bg-card/70"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                {slot.label}
              </span>
            </div>
            <p className="text-xl font-bold text-foreground">{value}</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed">{slot.description}</p>
          </motion.div>
        );
      })}
    </div>
  );
}
