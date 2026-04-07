// ── Sprint 6.0 — Shared Filter Bar ─────────────────────────────────
// Reusable across ROI, Capacidade and Saúde do Cliente test sections.
// Each filter slot is opt-in: only renders if options are provided.

import {
  Calendar,
  FolderKanban,
  User,
  Building2,
  GraduationCap,
  Users2,
} from "lucide-react";
import type { RoiPeriod, SeniorityLevel } from "@/modules/sprint6/types";

// ── Filter state shared across all Sprint 6.0 dashboards ───────────

export interface Sprint6FilterState {
  period: RoiPeriod;
  projectId: number | null;
  consultant: string | null;
  clienteId: number | null;
  department: string | null;
  seniorityLevel: SeniorityLevel | null;
}

export const DEFAULT_SPRINT6_FILTERS: Sprint6FilterState = {
  period: "180d",
  projectId: null,
  consultant: null,
  clienteId: null,
  department: null,
  seniorityLevel: null,
};

// ── Option types ────────────────────────────────────────────────────

export interface FilterOptions {
  /** Projects for dropdown. Functional today. */
  projects?: { id: number; name: string }[];
  /** Consultants for dropdown. Functional today (derived from tasks). */
  consultants?: string[];
  /** Clients for dropdown. Pending: requires client data source. */
  clientes?: { id: number; name: string }[];
  /** Departments for dropdown. Pending: requires users.department column. */
  departments?: string[];
  /** Whether to show the seniority filter. Pending: requires users.seniority_level. */
  showSeniority?: boolean;
}

// ── Periods ─────────────────────────────────────────────────────────

const PERIODS: { value: RoiPeriod; label: string }[] = [
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "180d", label: "180 dias" },
  { value: "all", label: "Tudo" },
];

const SENIORITY_OPTIONS: { value: SeniorityLevel; label: string }[] = [
  { value: "senior", label: "Sênior" },
  { value: "pleno", label: "Pleno" },
  { value: "junior", label: "Júnior" },
];

// ── Shared select wrapper ───────────────────────────────────────────

function FilterSelect({
  icon: Icon,
  value,
  onChange,
  placeholder,
  options,
  disabled,
  disabledLabel,
}: {
  icon: React.ElementType;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  disabledLabel?: string;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-xl border border-border/20 px-3 py-1.5 transition-all duration-200 ${
        disabled ? "bg-muted/10 opacity-50" : "bg-card/40 backdrop-blur-sm"
      }`}
      title={disabled ? disabledLabel : undefined}
    >
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="bg-transparent text-xs font-medium text-foreground outline-none cursor-pointer disabled:cursor-not-allowed min-w-0"
      >
        <option value="">{disabled ? (disabledLabel ?? placeholder) : placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────

interface Props {
  filters: Sprint6FilterState;
  onChange: (f: Sprint6FilterState) => void;
  options: FilterOptions;
}

export function Sprint6Filters({ filters, onChange, options }: Props) {
  const {
    projects = [],
    consultants = [],
    clientes = [],
    departments = [],
    showSeniority = false,
  } = options;

  return (
    <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
      {/* Period — always visible, always functional */}
      <div className="flex items-center gap-1 rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm p-0.5">
        <Calendar className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => onChange({ ...filters, period: p.value })}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
              filters.period === p.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Project — functional when options provided */}
      {projects.length > 0 && (
        <FilterSelect
          icon={FolderKanban}
          value={String(filters.projectId ?? "")}
          onChange={(v) => onChange({ ...filters, projectId: v ? Number(v) : null })}
          placeholder="Todos os projetos"
          options={projects.map((p) => ({ value: String(p.id), label: p.name }))}
        />
      )}

      {/* Consultant — functional when options provided */}
      {consultants.length > 0 && (
        <FilterSelect
          icon={User}
          value={filters.consultant ?? ""}
          onChange={(v) => onChange({ ...filters, consultant: v || null })}
          placeholder="Todos os consultores"
          options={consultants.map((c) => ({ value: c, label: c }))}
        />
      )}

      {/* Client — pending: needs client data */}
      {clientes.length > 0 ? (
        <FilterSelect
          icon={Building2}
          value={String(filters.clienteId ?? "")}
          onChange={(v) => onChange({ ...filters, clienteId: v ? Number(v) : null })}
          placeholder="Todos os clientes"
          options={clientes.map((c) => ({ value: String(c.id), label: c.name }))}
        />
      ) : null}

      {/* Department — pending: needs users.department column */}
      {departments.length > 0 ? (
        <FilterSelect
          icon={Building2}
          value={filters.department ?? ""}
          onChange={(v) => onChange({ ...filters, department: v || null })}
          placeholder="Todos os departamentos"
          options={departments.map((d) => ({ value: d, label: d }))}
        />
      ) : null}

      {/* Seniority — pending: needs users.seniority_level column */}
      {showSeniority && (
        <FilterSelect
          icon={GraduationCap}
          value={filters.seniorityLevel ?? ""}
          onChange={(v) =>
            onChange({ ...filters, seniorityLevel: (v as SeniorityLevel) || null })
          }
          placeholder="Todos os níveis"
          options={SENIORITY_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
          disabled={SENIORITY_OPTIONS.length === 0}
          disabledLabel="Pendente: seniority_level"
        />
      )}
    </div>
  );
}
