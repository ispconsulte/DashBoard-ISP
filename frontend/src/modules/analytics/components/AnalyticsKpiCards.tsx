import { memo } from "react";
import { FolderKanban, Clock, CheckCircle2, AlertTriangle, TrendingUp, Briefcase } from "lucide-react";
import { motion } from "framer-motion";
import { formatHoursHuman } from "@/modules/tasks/utils";

type Props = {
  clients: number;
  activeProjects: number;
  totalHours: number;
  totalTasks: number;
  doneCount: number;
  overdueCount: number;
  loading?: boolean;
};

function AnalyticsKpiCardsInner({ clients, activeProjects, totalHours, totalTasks, doneCount, overdueCount, loading }: Props) {
  const pendingCount = totalTasks - doneCount - overdueCount;
  const completionPct = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0;

  const kpis = [
    {
      label: "Meus Projetos",
      value: clients.toLocaleString("pt-BR"),
      sub: activeProjects > 0 ? `${activeProjects} com atividade recente` : "Nenhum ativo no período",
      icon: Briefcase,
      accent: "hsl(262 83% 58%)",
    },
    {
      label: "Horas Alocadas",
      value: formatHoursHuman(totalHours),
      sub: activeProjects > 0 ? `~${formatHoursHuman(totalHours / activeProjects)} por projeto` : "Sem registro de horas",
      icon: Clock,
      accent: "hsl(200 80% 55%)",
    },
    {
      label: "Concluídas",
      value: doneCount.toLocaleString("pt-BR"),
      sub: completionPct >= 80 ? `${completionPct}% — Excelente ritmo!` : completionPct >= 50 ? `${completionPct}% — Bom progresso` : `${completionPct}% — Atenção necessária`,
      icon: CheckCircle2,
      accent: "hsl(160 84% 39%)",
    },
    {
      label: "Em Andamento",
      value: pendingCount.toLocaleString("pt-BR"),
      sub: pendingCount > 0 ? `${totalTasks > 0 ? Math.round((pendingCount / totalTasks) * 100) : 0}% aguardando conclusão` : "Nenhuma pendente",
      icon: TrendingUp,
      accent: "hsl(270 80% 55%)",
    },
    {
      label: "Atrasadas",
      value: overdueCount.toLocaleString("pt-BR"),
      sub: overdueCount > 0 ? `${Math.round((overdueCount / Math.max(totalTasks, 1)) * 100)}% — Priorizar resolução` : "Nenhum atraso ✓",
      icon: AlertTriangle,
      accent: overdueCount > 0 ? "hsl(0 84% 60%)" : "hsl(160 84% 39%)",
    },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 w-full">
      {kpis.map((k, i) => {
        const Icon = k.icon;
        return (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.06, ease: "easeOut" }}
            className="group relative overflow-hidden rounded-2xl border border-white/[0.06] p-5 transition-all duration-500 hover:-translate-y-0.5 hover:border-white/[0.12] hover:shadow-xl w-full"
            style={{
              background: "linear-gradient(145deg, hsl(270 50% 14% / 0.7), hsl(234 45% 10% / 0.5))",
            }}
          >
            {/* Top accent dot */}
            <div
              className="absolute top-3 right-3 h-2 w-2 rounded-full opacity-50 group-hover:opacity-100 transition-opacity"
              style={{ background: k.accent }}
            />

            <div className="flex items-center justify-center gap-2.5 mb-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
                style={{ background: `${k.accent.replace(")", " / 0.15)")}` }}
              >
                <Icon className="h-4.5 w-4.5" style={{ color: k.accent }} />
              </div>
            </div>

            <p className="text-[11px] font-semibold text-white/40 leading-tight text-center mb-1">{k.label}</p>
            {loading ? (
              <div className="flex justify-center py-1">
                <div className="h-5 w-16 rounded-md bg-white/[0.06] animate-pulse" />
              </div>
            ) : (
              <p className="text-2xl font-bold text-white/90 text-center">{k.value}</p>
            )}
            <p className="text-[10px] text-white/25 mt-0.5 text-center">{loading ? "Carregando…" : k.sub}</p>
          </motion.div>
        );
      })}
    </div>
  );
}

export default memo(AnalyticsKpiCardsInner);
