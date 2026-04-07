// ── Sprint 6.0 — ROI Filters ───────────────────────────────────────
// Lightweight filter bar for the ROI dashboard test section.

import { useState } from "react";
import { Calendar, FolderKanban } from "lucide-react";

export interface RoiFilterState {
  period: "30d" | "90d" | "180d" | "all";
  projectId: number | null;
}

interface Props {
  filters: RoiFilterState;
  onChange: (f: RoiFilterState) => void;
  projects: { id: number; name: string }[];
}

const PERIODS = [
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "180d", label: "180 dias" },
  { value: "all", label: "Tudo" },
] as const;

export function RoiFilters({ filters, onChange, projects }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Period */}
      <div className="flex items-center gap-1 rounded-lg border border-border/30 bg-muted/30 p-0.5">
        <Calendar className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => onChange({ ...filters, period: p.value })}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              filters.period === p.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Project selector */}
      {projects.length > 0 && (
        <div className="flex items-center gap-1.5 rounded-lg border border-border/30 bg-muted/30 px-2.5 py-1">
          <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value={filters.projectId ?? ""}
            onChange={(e) =>
              onChange({
                ...filters,
                projectId: e.target.value ? Number(e.target.value) : null,
              })
            }
            className="bg-transparent text-xs font-medium text-foreground outline-none cursor-pointer"
          >
            <option value="">Todos os projetos</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
