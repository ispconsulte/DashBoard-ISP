import { useState } from "react";
import { Search, X, Filter, ChevronDown, User, FolderKanban, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CustomSelect, MultiSelectProjects } from "../../shared/FilterDropdowns";

export type AnalyticsFilterState = {
  period: "30d" | "90d" | "180d" | "all";
  status: "all" | "done" | "pending" | "overdue";
  projectIds: number[];
  consultant: string;
};

type ProjectOption = { id: number; name: string; clientName?: string; searchText?: string };

type Props = {
  filters: AnalyticsFilterState;
  onChange: (filters: AnalyticsFilterState) => void;
  projects: ProjectOption[];
  consultants: string[];
  isAdmin: boolean;
  myProjectIds?: Set<number>;
  hideFilters?: boolean;
};

const PERIODS: { value: string; label: string }[] = [
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "180d", label: "180 dias" },
  { value: "all", label: "Todos os períodos" },
];

const STATUSES: { key: AnalyticsFilterState["status"]; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "done", label: "Concluídas" },
  { key: "pending", label: "Em andamento" },
  { key: "overdue", label: "Atrasadas" },
];


export default function AnalyticsFilters({ filters, onChange, projects, consultants, isAdmin, myProjectIds, hideFilters = false }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const activeCount =
    (filters.period !== "180d" ? 1 : 0) +
    (filters.status !== "all" ? 1 : 0) +
    (filters.projectIds.length > 0 ? 1 : 0) +
    (filters.consultant ? 1 : 0);

  // Search filters project list inline
  const handleSearchSelect = (projectId: number | null) => {
    if (projectId === null) {
      onChange({ ...filters, projectIds: [] });
    } else {
      onChange({ ...filters, projectIds: [projectId] });
    }
  };

  // Filter projects by search
  const searchResults = searchQuery.trim()
    ? projects.filter((p) => (p.searchText ?? `${p.name} ${p.clientName ?? ""}`).toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  return (
    <div className="space-y-2 flex flex-col items-center w-full">
      {/* Search + Filter toggle side by side (same as Tarefas) */}
      <div className="flex items-center justify-center gap-2 flex-wrap w-full px-1 sm:px-0">
        {/* Search field */}
        <div className="relative flex items-center flex-1 min-w-0 max-w-[320px]">
          <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-white/30" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar projeto ou cliente..."
            className="h-[38px] w-full rounded-xl border border-white/[0.06] bg-white/[0.03] pl-9 pr-7 text-[13px] font-semibold text-white/50 placeholder:text-white/30 outline-none transition hover:border-white/[0.12] hover:text-white/70 focus:border-[hsl(262_83%_58%/0.4)] focus:bg-[hsl(262_83%_58%/0.1)] focus:text-[hsl(262_83%_58%)]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => { setSearchQuery(""); handleSearchSelect(null); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          {/* Search dropdown */}
          {searchQuery.trim() && searchResults.length > 0 && (
            <div
              className="absolute left-0 top-full z-[100] mt-1 max-h-60 w-full overflow-auto rounded-2xl border border-white/[0.08] p-1.5 shadow-xl shadow-black/40"
              style={{ background: "hsl(var(--ana-surface))" }}
            >
              {searchResults.slice(0, 10).map((p) => (
                <button
                  key={p.id}
                  onClick={() => { handleSearchSelect(p.id); setSearchQuery(p.name); }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-semibold text-white/50 hover:bg-white/[0.05] hover:text-white/70 transition"
                >
                  <FolderKanban className="h-3.5 w-3.5 shrink-0 opacity-40" />
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filter toggle — hidden for non-admin users */}
        {!hideFilters && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className={`flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-xl border px-4 py-[9px] text-[13px] font-semibold transition ${
              expanded
                ? "border-[hsl(var(--ana-purple)/0.4)] bg-[hsl(var(--ana-purple)/0.1)] text-[hsl(var(--ana-purple))]"
                : "border-white/[0.06] bg-white/[0.03] text-white/50 hover:border-white/[0.12] hover:text-white/70"
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            Filtros
            {activeCount > 0 && (
              <span className="rounded-full bg-[hsl(var(--ana-purple))] px-1.5 py-0.5 text-[10px] font-bold text-white">
                {activeCount}
              </span>
            )}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      {/* Expanded filters panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "visible" }}
            className="w-full"
          >
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-end justify-center gap-3 sm:gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 sm:p-4 relative z-[100]" style={{ overflow: "visible" }}>
              {/* Status — same dropdown pattern as Tarefas */}
              <div className="space-y-1.5 w-full sm:w-auto">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Status</label>
                <CustomSelect
                  value={filters.status}
                  onChange={(v) => onChange({ ...filters, status: (v || "all") as AnalyticsFilterState["status"] })}
                  options={STATUSES.map((s) => ({ value: s.key, label: s.label }))}
                  placeholder="Todos"
                  icon={Filter}
                  accentVar="--ana-purple"
                  surfaceVar="--ana-surface"
                />
              </div>

              {/* Period dropdown (same as Tarefas) */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Período</label>
                <CustomSelect
                  value={filters.period}
                  onChange={(v) => onChange({ ...filters, period: (v || "all") as AnalyticsFilterState["period"] })}
                  options={PERIODS}
                  placeholder="Todos os períodos"
                  icon={Calendar}
                  accentVar="--ana-purple"
                  surfaceVar="--ana-surface"
                  subtleSelection
                />
              </div>

              {/* Project dropdown */}
              {projects.length > 1 && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Projeto</label>
                  <MultiSelectProjects
                    value={filters.projectIds.map(String)}
                    onChange={(vals) => onChange({ ...filters, projectIds: vals.map(Number) })}
                    options={projects.map((p) => ({ value: String(p.id), label: p.name }))}
                    placeholder="Todos os projetos"
                    icon={FolderKanban}
                    mineSet={myProjectIds ? new Set([...myProjectIds].map(String)) : undefined}
                    accentVar="--ana-purple"
                    surfaceVar="--ana-surface"
                  />
                </div>
              )}

              {/* Consultant filter */}
              {(isAdmin ? consultants.length > 1 : consultants.length > 0) && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Consultor</label>
                  <CustomSelect
                    value={filters.consultant}
                    onChange={(v) => onChange({ ...filters, consultant: v })}
                    options={consultants.map((c) => ({ value: c, label: c }))}
                    placeholder="Todos os consultores"
                    icon={User}
                    accentVar="--ana-purple"
                    surfaceVar="--ana-surface"
                  />
                </div>
              )}

              {/* Clear filters — same panel pattern as Tarefas */}
              {activeCount > 0 && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-transparent">‎</label>
                  <button
                    type="button"
                    onClick={() => { onChange({ period: "180d", status: "all", projectIds: [], consultant: "" }); setSearchQuery(""); }}
                    className="flex min-h-[44px] h-9 w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-[12px] font-semibold text-white/40 hover:text-white/60 hover:border-white/[0.15] transition"
                  >
                    <X className="h-3 w-3" />
                    Limpar
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
