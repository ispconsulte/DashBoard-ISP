import { Search, X, Filter, ChevronDown, FolderKanban, User, Calendar } from "lucide-react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CustomSelect, MultiSelectProjects } from "../../shared/FilterDropdowns";
import { MIN_CUSTOM_FILTER_DATE, getCustomDateCommit } from "../customDateRange";
import {
  DEFAULT_TASK_DATE_FILTER_MODE,
  taskDateFilterOptions,
  type TaskDateFilterMode,
} from "../taskDateFilter";

type TaskFiltersProps = {
  search: string;
  setSearch: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
  deadline: string;
  setDeadline: (value: string) => void;
  period: string;
  setPeriod: (value: string) => void;
  dateFrom: string;
  setDateFrom: (value: string) => void;
  dateTo: string;
  setDateTo: (value: string) => void;
  dateFilterMode: TaskDateFilterMode;
  setDateFilterMode: (value: TaskDateFilterMode) => void;
  deadlineTo: string;
  setDeadlineTo: (value: string) => void;
  searchRef?: React.RefObject<HTMLInputElement>;
  consultant: string;
  setConsultant: (value: string) => void;
  consultantOptions?: string[];
  project: string[];
  setProject: (value: string[]) => void;
  projectOptions?: string[];
  projectDisabled?: boolean;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  myProjectNames?: Set<string>;
  hideFilters?: boolean;
};

const statusChips = [
  { value: "all", label: "Todos" },
  { value: "done", label: "Concluídas" },
  { value: "pending", label: "Em andamento" },
  { value: "overdue", label: "Atrasadas" },
];

const periodChips = [
  { value: "all", label: "Todos os períodos" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "custom", label: "Personalizado" },
];

const isFullDateInput = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

export function TaskFilters({
  search,
  setSearch,
  status,
  setStatus,
  deadline,
  setDeadline,
  period,
  setPeriod,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  dateFilterMode,
  setDateFilterMode,
  deadlineTo,
  setDeadlineTo,
  searchRef,
  consultant,
  setConsultant,
  consultantOptions = [],
  project,
  setProject,
  projectOptions = [],
  projectDisabled = false,
  hasActiveFilters = false,
  onClearFilters,
  myProjectNames,
  hideFilters = false,
}: TaskFiltersProps) {
  const [expanded, setExpanded] = useState(false);
  const [draftDateFrom, setDraftDateFrom] = useState(dateFrom);
  const [draftDateTo, setDraftDateTo] = useState(dateTo);

  useEffect(() => {
    setDraftDateFrom(dateFrom);
  }, [dateFrom]);

  useEffect(() => {
    setDraftDateTo(dateTo);
  }, [dateTo]);

  const applyDateCommit = (commit: { dateFrom?: string; dateTo?: string }) => {
    if (commit.dateFrom !== undefined) setDateFrom(commit.dateFrom);
    if (commit.dateTo !== undefined) setDateTo(commit.dateTo);
  };

  const handleDateFromChange = (value: string) => {
    if (isFullDateInput(value) && value < MIN_CUSTOM_FILTER_DATE) return;
    setDraftDateFrom(value);
    const commit = getCustomDateCommit("from", value, dateFrom, dateTo);
    applyDateCommit(commit);
    if (commit.dateTo === "") setDraftDateTo("");
  };

  const handleDateToChange = (value: string) => {
    const minDateTo = dateFrom || MIN_CUSTOM_FILTER_DATE;
    if (isFullDateInput(value) && value < minDateTo) return;
    setDraftDateTo(value);
    applyDateCommit(getCustomDateCommit("to", value, dateFrom, dateTo));
  };

  const activeCount =
    (status !== "all" ? 1 : 0) +
    (period !== "all" ? 1 : 0) +
    (dateFilterMode !== DEFAULT_TASK_DATE_FILTER_MODE ? 1 : 0) +
    (consultant !== "all" && consultant ? 1 : 0) +
    (project.length > 0 ? 1 : 0);

  return (
    <div className="space-y-2 flex flex-col items-center w-full">
      {/* Search + Filter toggle side by side */}
      <div className="flex items-center justify-center gap-2 flex-wrap w-full px-1 sm:px-0">
        {/* Search field */}
        <div className="relative flex items-center flex-1 min-w-0 max-w-[320px]">
          <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-white/30" />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar tarefa..."
            className="h-[38px] w-full rounded-xl border border-white/[0.06] bg-white/[0.03] pl-9 pr-7 text-[13px] font-semibold text-white/50 placeholder:text-white/30 outline-none transition hover:border-white/[0.12] hover:text-white/70 focus:border-[hsl(var(--task-purple)/0.4)] focus:bg-[hsl(var(--task-purple)/0.1)] focus:text-[hsl(var(--task-purple))]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Filter toggle — hidden for non-admin users */}
        {!hideFilters && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className={`flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-xl border px-4 py-[9px] text-[13px] font-semibold transition ${
              expanded
                ? "border-[hsl(var(--task-purple)/0.4)] bg-[hsl(var(--task-purple)/0.1)] text-[hsl(var(--task-purple))]"
                : "border-white/[0.06] bg-white/[0.03] text-white/50 hover:border-white/[0.12] hover:text-white/70"
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            Filtros
            {activeCount > 0 && (
              <span className="rounded-full bg-[hsl(var(--task-purple))] px-1.5 py-0.5 text-[10px] font-bold text-white">
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
              {/* Status */}
              <div className="space-y-1.5 w-full sm:w-auto">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Status</label>
                <CustomSelect
                  value={status}
                  onChange={setStatus}
                  options={statusChips}
                  placeholder="Todos"
                  icon={Filter}
                />
              </div>

              {/* Date field dropdown */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Base de data</label>
                <CustomSelect
                  value={dateFilterMode}
                  onChange={(value) => setDateFilterMode(value as TaskDateFilterMode)}
                  options={taskDateFilterOptions}
                  placeholder="Criação + tempo gasto (padrão)"
                  icon={Calendar}
                  subtleSelection
                />
              </div>

              {/* Period dropdown */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Período</label>
                <CustomSelect
                  value={period}
                  onChange={setPeriod}
                  options={periodChips.map(c => ({ value: c.value, label: c.label }))}
                  placeholder="Todos os períodos"
                  icon={Calendar}
                  subtleSelection
                />
              </div>

              {/* Project dropdown — multi-select */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Projeto</label>
                <MultiSelectProjects
                  value={project}
                  onChange={setProject}
                  options={projectOptions.map(o => ({ value: o, label: o }))}
                  placeholder="Todos projetos"
                  icon={FolderKanban}
                  mineSet={myProjectNames}
                />
              </div>

              {/* Consultant dropdown — after project */}
              {consultantOptions.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Consultor</label>
                  <CustomSelect
                    value={consultant}
                    onChange={setConsultant}
                    options={consultantOptions.map(o => ({ value: o, label: o }))
                    }
                    placeholder="Todos consultores"
                    icon={User}
                  />
                </div>
              )}

              {/* Custom date range */}
              {period === "custom" && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Intervalo</label>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="date"
                      min={MIN_CUSTOM_FILTER_DATE}
                      value={draftDateFrom}
                      onChange={(e) => handleDateFromChange(e.target.value)}
                      className="h-9 min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-[hsl(var(--task-surface))] px-2.5 text-xs text-white/70 outline-none"
                    />
                    <input
                      type="date"
                      min={dateFrom || MIN_CUSTOM_FILTER_DATE}
                      value={draftDateTo}
                      onChange={(e) => handleDateToChange(e.target.value)}
                      className="h-9 min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-[hsl(var(--task-surface))] px-2.5 text-xs text-white/70 outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Clear filters */}
              {hasActiveFilters && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-transparent">‎</label>
                  <button
                    type="button"
                    onClick={onClearFilters}
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
