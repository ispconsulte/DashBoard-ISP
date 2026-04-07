// ── Sprint 6.0 — Client Health: Benchmark Comparison ───────────────
// Shows client averages vs sector benchmarks side by side.

import { Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ClientHealthSummary } from "@/modules/sprint6/types";

interface Props {
  summary: ClientHealthSummary;
}

interface MetricRowProps {
  label: string;
  clientValue: string;
  benchmarkValue: string;
  isGood: boolean;
}

function MetricRow({ label, clientValue, benchmarkValue, isGood }: MetricRowProps) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/15 bg-card/30 px-4 py-3">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Clientes</p>
          <p className="text-sm font-semibold text-foreground">{clientValue}</p>
        </div>
        <span className="text-muted-foreground/30">vs</span>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Benchmark</p>
          <p className="text-sm font-semibold text-muted-foreground">{benchmarkValue}</p>
        </div>
        <Badge
          variant="outline"
          className={`text-[9px] ${
            isGood
              ? "bg-green-500/10 text-green-400 border-green-500/20"
              : "bg-destructive/10 text-destructive border-destructive/20"
          }`}
        >
          {isGood ? "Acima" : "Abaixo"}
        </Badge>
      </div>
    </div>
  );
}

export function ClientHealthBenchmarkCard({ summary }: Props) {
  const { clients, benchmarks } = summary;

  if (!benchmarks || clients.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/25 bg-black/10 px-5 py-6 text-sm text-muted-foreground">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03]">
            <Target className="h-4 w-4 text-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">O comparativo com benchmark ainda está incompleto.</p>
            <p className="mt-2 leading-relaxed">
              Esta seção depende de duas frentes ao mesmo tempo: clientes válidos em <strong className="text-foreground">client_kpis</strong> e referência preenchida em <strong className="text-foreground">client_benchmarks</strong>. Cadastre ou revise os benchmarks setoriais na Governança de Dados para liberar a comparação.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const avgEbitda = clients.reduce((s, c) => s + (c.ebitda ?? 0), 0) / clients.length;
  const avgChurn = clients.reduce((s, c) => s + (c.churn ?? 0), 0) / clients.length;
  const avgNps = clients.reduce((s, c) => s + (c.nps ?? 0), 0) / clients.length;

  return (
    <div className="space-y-2">
      <MetricRow
        label="EBITDA"
        clientValue={clients.length > 0 ? `R$ ${Math.round(avgEbitda).toLocaleString("pt-BR")}` : "Não encontrado"}
        benchmarkValue={`R$ ${Math.round(benchmarks.ebitda).toLocaleString("pt-BR")}`}
        isGood={avgEbitda >= benchmarks.ebitda}
      />
      <MetricRow
        label="Churn"
        clientValue={clients.length > 0 ? `${(Math.round(avgChurn * 10) / 10)}%` : "Não encontrado"}
        benchmarkValue={`${benchmarks.churn}%`}
        isGood={avgChurn <= benchmarks.churn}
      />
      <MetricRow
        label="NPS"
        clientValue={clients.length > 0 ? String(Math.round(avgNps)) : "Não encontrado"}
        benchmarkValue={String(benchmarks.nps)}
        isGood={avgNps >= benchmarks.nps}
      />
    </div>
  );
}
