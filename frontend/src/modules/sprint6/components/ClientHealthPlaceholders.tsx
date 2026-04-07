// ── Sprint 6.0 — Client Health: Structured Placeholder ─────────────
import { motion } from "framer-motion";
import { BarChart3, AlertTriangle, Target, Clock } from "lucide-react";

interface PlaceholderSlotProps {
  icon: React.ElementType;
  title: string;
  description: string;
  dataSource: string;
  index: number;
}

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

function PlaceholderSlot({ icon: Icon, title, description, dataSource, index }: PlaceholderSlotProps) {
  return (
    <motion.div
      variants={fadeUp}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      className="rounded-2xl border border-dashed border-border/30 bg-card/30 backdrop-blur-sm p-5 space-y-3 transition-all duration-200 hover:bg-card/50"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/40">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-[11px] text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="rounded-xl bg-muted/20 border border-border/10 px-3 py-2">
        <p className="text-[10px] text-muted-foreground">
          <span className="font-medium">Fonte de dados:</span> {dataSource}
        </p>
      </div>
    </motion.div>
  );
}

export function ClientHealthPlaceholders() {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      className="grid grid-cols-1 gap-4 md:grid-cols-2"
    >
      <PlaceholderSlot
        icon={BarChart3}
        title="Tendências Temporais"
        description="Gráfico de evolução mensal de EBITDA, Churn e NPS por cliente"
        dataSource="client_kpis (agrupado por month) — requer tabela"
        index={0}
      />
      <PlaceholderSlot
        icon={AlertTriangle}
        title="Alertas de Risco"
        description="Clientes com health score abaixo do limiar configurável"
        dataSource="client_kpis + fórmula de health score — requer tabela + regra"
        index={1}
      />
      <PlaceholderSlot
        icon={Target}
        title="Benchmark Comparativo"
        description="Comparação com médias setoriais (EBITDA, Churn, NPS)"
        dataSource="Configuração admin (benchmarks) — requer input manual"
        index={2}
      />
      <PlaceholderSlot
        icon={Clock}
        title="Histórico de Score"
        description="Evolução do health score ao longo dos meses"
        dataSource="client_kpis (derivado) — requer tabela + fórmula"
        index={3}
      />
    </motion.div>
  );
}
