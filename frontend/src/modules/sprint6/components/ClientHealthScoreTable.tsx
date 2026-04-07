// ── Sprint 6.0 — Client Health: Score Table ────────────────────────
// Shows all clients with their KPIs and health score in a responsive layout.

import { Badge } from "@/components/ui/badge";
import type { ClientKpi } from "@/modules/sprint6/types";

interface Props {
  clients: ClientKpi[];
}

function scoreColor(score: number | null): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 70) return "text-green-400";
  if (score >= 40) return "text-amber-400";
  return "text-destructive";
}

function scoreBadge(score: number | null) {
  if (score == null) return { label: "N/A", className: "bg-muted text-muted-foreground" };
  if (score >= 70) return { label: "Saudável", className: "bg-green-500/10 text-green-400 border-green-500/20" };
  if (score >= 40) return { label: "Atenção", className: "bg-amber-500/10 text-amber-400 border-amber-500/20" };
  return { label: "Risco", className: "bg-destructive/10 text-destructive border-destructive/20" };
}

export function ClientHealthScoreTable({ clients }: Props) {
  if (clients.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/25 bg-black/10 px-5 py-6 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">Ainda não existe carteira suficiente para ordenar o health score.</p>
        <p className="mt-2 leading-relaxed">
          O ranking só aparece quando <strong className="text-foreground">client_kpis</strong> traz clientes válidos para o período e o identificador deles casa com a carteira ativa. Sem isso, não há como montar score, risco e prioridade operacional por cliente.
        </p>
      </div>
    );
  }

  const sorted = [...clients].sort((a, b) => (a.healthScore ?? 100) - (b.healthScore ?? 100));

  return (
    <div className="space-y-2">
      {sorted.map((c) => {
        const badge = scoreBadge(c.healthScore);
        return (
          <div
            key={c.clienteName}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-border/15 bg-card/30 px-4 py-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="text-center shrink-0 w-12">
                <p className={`text-lg font-bold ${scoreColor(c.healthScore)}`}>
                  {c.healthScore != null ? c.healthScore.toFixed(0) : "Não encontrado"}
                </p>
                <p className="text-[8px] text-muted-foreground uppercase">Score</p>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{c.clienteName}</p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                   <span>EBITDA: {c.ebitda != null ? `R$ ${c.ebitda.toLocaleString("pt-BR")}` : "Não encontrado"}</span>
                   <span>Churn: {c.churn != null ? `${c.churn}%` : "Não encontrado"}</span>
                   <span>NPS: {c.nps ?? "Não encontrado"}</span>
                </div>
              </div>
            </div>
            <Badge variant="outline" className={`text-[9px] shrink-0 ${badge.className}`}>
              {badge.label}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
