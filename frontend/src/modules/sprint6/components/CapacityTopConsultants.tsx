// ── Sprint 6.0 — Capacity: Top Consultants Ranking ─────────────────

import { User, AlertTriangle } from "lucide-react";
import type { CapacityConsultantItem } from "@/modules/sprint6/hooks/useCapacityData";
import { formatHoursHuman } from "@/modules/tasks/utils";
import { Badge } from "@/components/ui/badge";

interface Props {
  data: CapacityConsultantItem[];
  maxItems?: number;
}

export function CapacityTopConsultants({ data, maxItems = 10 }: Props) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-border/40 bg-muted/30 py-12 text-sm text-muted-foreground">
        Sem dados de consultores
      </div>
    );
  }

  const maxHours = data[0]?.totalHours ?? 1;
  const items = data.slice(0, maxItems);

  return (
    <div className="space-y-2">
      {items.map((c, i) => (
        <div
          key={c.name}
          className={`flex items-center gap-2 sm:gap-3 rounded-lg border px-3 py-2.5 transition-all duration-200 ${
            c.isOverloaded
              ? "border-destructive/20 bg-destructive/[0.04]"
              : "border-border/20 bg-card/50"
          }`}
        >
          {/* Rank */}
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary shrink-0">
            {i + 1}
          </span>

          {/* Avatar — hidden on very small screens */}
          <div className="hidden sm:flex h-7 w-7 items-center justify-center rounded-full bg-muted shrink-0">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-medium text-foreground truncate">{c.name}</p>
              {c.isOverloaded && <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
              <span>{c.taskCount} {c.taskCount === 1 ? "tarefa" : "tarefas"}</span>
              {c.department && <span className="hidden sm:inline">· {c.department}</span>}
              {c.seniority && <span className="hidden md:inline">· {c.seniority}</span>}
            </div>
          </div>

          {/* Utilization badge */}
          {c.utilizationPercent != null && (
            <Badge
              variant="outline"
              className={`text-[9px] shrink-0 ${
                c.isOverloaded
                  ? "bg-destructive/10 text-destructive border-destructive/20"
                  : c.utilizationPercent > 80
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  : "bg-primary/10 text-primary border-primary/20"
              }`}
            >
              {c.utilizationPercent}%
            </Badge>
          )}

          {/* Hours + bar */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-semibold text-foreground w-12 sm:w-14 text-right">
              {formatHoursHuman(c.totalHours)}
            </span>
            <div className="hidden sm:block h-1.5 w-16 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${
                  c.isOverloaded ? "bg-destructive" : "bg-primary"
                }`}
                style={{ width: `${Math.min((c.totalHours / maxHours) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
