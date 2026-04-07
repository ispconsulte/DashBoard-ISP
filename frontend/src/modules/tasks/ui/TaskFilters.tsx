import { Search, X, Filter, ChevronDown, FolderKanban, User, Calendar } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
  { value: "all", label: "Tudo" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "custom", label: "Período" },
];

/* ── Custom dropdown with search/autocomplete ── */
function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
  icon: Icon,
  mineSet,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  icon?: React.ComponentType<{ className?: string }>;
  mineSet?: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const selected = options.find((o) => o.value === value);

  const filtered = search.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const sortedOptions = mineSet
    ? [...filtered].sort((a, b) => {
        const aM = mineSet.has(a.value) ? 0 : 1;
        const bM = mineSet.has(b.value) ? 0 : 1;
        return aM - bM || a.label.localeCompare(b.label);
      })
    : filtered;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex h-9 w-full min-w-0 sm:min-w-[170px] sm:w-auto items-center gap-2 rounded-xl border px-3 text-[12px] font-semibold transition-all ${
          value && value !== "all"
            ? "border-[hsl(var(--task-purple)/0.4)] bg-[hsl(var(--task-purple)/0.1)] text-white/80"
            : "border-white/[0.08] bg-[hsl(var(--task-surface))] text-white/50"
        } hover:border-white/[0.15]`}
      >
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0 opacity-50" />}
        <span className="flex-1 truncate text-left">{selected?.label || placeholder}</span>
        <ChevronDown className={`h-3 w-3 shrink-0 opacity-40 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-[200] mt-1 min-w-[220px] rounded-2xl border border-white/[0.08] shadow-xl shadow-black/50 overflow-hidden flex flex-col"
            style={{ background: "hsl(260 30% 12%)", maxHeight: "260px" }}
          >
            {options.length > 5 && (
              <div className="shrink-0 px-1.5 pt-1.5 pb-1 border-b border-white/[0.06]" style={{ background: "hsl(260 30% 12%)" }}>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/30" />
                  <input
                    ref={inputRef}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar..."
                    className="h-8 w-full rounded-full border border-white/[0.08] bg-white/[0.04] pl-7 pr-3 text-[11px] text-white/70 outline-none focus:border-[hsl(var(--task-purple)/0.4)] placeholder:text-white/25"
                  />
                </div>
              </div>
            )}
            <div className="overflow-y-auto flex-1 p-1.5">
              <button
                onClick={() => { onChange("all"); setOpen(false); setSearch(""); }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-[12px] font-semibold transition ${
                  value === "all" || !value ? "bg-[hsl(var(--task-purple)/0.15)] text-white/90" : "text-white/40 hover:bg-white/[0.05] hover:text-white/60"
                }`}
              >
                {placeholder}
              </button>

              {mineSet && sortedOptions.length > 0 && (
                <>
                  {sortedOptions.some(o => mineSet.has(o.value)) && (
                    <div className="px-3 pt-2 pb-1 text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--task-purple)/0.6)]">Projetos que faço parte</div>
                  )}
                  {sortedOptions.filter(o => mineSet.has(o.value)).map((o) => (
                    <button
                      key={o.value}
                      onClick={() => { onChange(o.value); setOpen(false); setSearch(""); }}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-[12px] font-semibold transition ${
                        value === o.value
                          ? "bg-[hsl(var(--task-purple)/0.15)] text-white/90"
                          : "text-white/50 hover:bg-white/[0.05] hover:text-white/70"
                      }`}
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--task-purple))]" />
                      <span className="truncate">{o.label}</span>
                    </button>
                  ))}
                  {sortedOptions.some(o => !mineSet.has(o.value)) && (
                    <div className="px-3 pt-3 pb-1 text-[9px] font-bold uppercase tracking-widest text-white/20">Outros</div>
                  )}
                  {sortedOptions.filter(o => !mineSet.has(o.value)).map((o) => (
                    <button
                      key={o.value}
                      onClick={() => { onChange(o.value); setOpen(false); setSearch(""); }}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-[12px] font-semibold transition ${
                        value === o.value
                          ? "bg-[hsl(var(--task-purple)/0.15)] text-white/90"
                          : "text-white/40 hover:bg-white/[0.05] hover:text-white/60"
                      }`}
                    >
                      <span className="truncate">{o.label}</span>
                    </button>
                  ))}
                </>
              )}

              {!mineSet && sortedOptions.map((o) => (
                <button
                  key={o.value}
                  onClick={() => { onChange(o.value); setOpen(false); setSearch(""); }}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-[12px] font-semibold transition ${
                    value === o.value
                      ? "bg-[hsl(var(--task-purple)/0.15)] text-white/90"
                      : "text-white/40 hover:bg-white/[0.05] hover:text-white/60"
                  }`}
                >
                  <span className="truncate">{o.label}</span>
                </button>
              ))}

              {sortedOptions.length === 0 && search.trim() && (
                <p className="px-3 py-4 text-center text-[11px] text-white/30">Nenhum resultado</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Multi-select dropdown for projects ── */
function MultiSelectProjects({
  value,
  onChange,
  options,
  placeholder,
  icon: Icon,
  mineSet,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  icon?: React.ComponentType<{ className?: string }>;
  mineSet?: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const isAll = value.length === 0;

  const filtered = search.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const sortedOptions = mineSet
    ? [...filtered].sort((a, b) => {
        const aM = mineSet.has(a.value) ? 0 : 1;
        const bM = mineSet.has(b.value) ? 0 : 1;
        return aM - bM || a.label.localeCompare(b.label);
      })
    : filtered;

  const toggleOption = (v: string) => {
    if (value.includes(v)) {
      onChange(value.filter((x) => x !== v));
    } else {
      onChange([...value, v]);
    }
  };

  const displayLabel = isAll
    ? placeholder
    : value.length === 1
      ? options.find((o) => o.value === value[0])?.label ?? placeholder
      : `${value.length} projetos`;

  const renderOption = (o: { value: string; label: string }, showDot?: boolean) => {
    const isSelected = value.includes(o.value);
    return (
      <button
        key={o.value}
        onClick={(e) => { e.preventDefault(); toggleOption(o.value); }}
        className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-semibold transition mb-0.5 ${
          isSelected
            ? "bg-[hsl(var(--task-purple)/0.12)] border border-[hsl(var(--task-purple)/0.25)] text-white/90"
            : "border border-transparent text-white/40 hover:bg-white/[0.05] hover:text-white/60"
        }`}
      >
        <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition ${
          isSelected
            ? "border-[hsl(var(--task-purple))] bg-[hsl(var(--task-purple))]"
            : "border-white/20 bg-transparent"
        }`}>
          {isSelected && (
            <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          )}
        </span>
        {showDot && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--task-purple))]" />}
        <span className="truncate">{o.label}</span>
      </button>
    );
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex h-9 w-full min-w-0 sm:min-w-[170px] sm:w-auto items-center gap-2 rounded-xl border px-3 text-[12px] font-semibold transition-all ${
          !isAll
            ? "border-[hsl(var(--task-purple)/0.4)] bg-[hsl(var(--task-purple)/0.1)] text-white/80"
            : "border-white/[0.08] bg-[hsl(var(--task-surface))] text-white/50"
        } hover:border-white/[0.15]`}
      >
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0 opacity-50" />}
        <span className="flex-1 truncate text-left">{displayLabel}</span>
        {!isAll && (
          <span className="rounded-full bg-[hsl(var(--task-purple))] px-1.5 py-0.5 text-[10px] font-bold text-white">{value.length}</span>
        )}
        <ChevronDown className={`h-3 w-3 shrink-0 opacity-40 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-[200] mt-1 min-w-[240px] rounded-2xl border border-white/[0.08] shadow-xl shadow-black/50 overflow-hidden flex flex-col"
            style={{ background: "hsl(260 30% 12%)", maxHeight: "300px" }}
          >
            {options.length > 5 && (
              <div className="shrink-0 px-1.5 pt-1.5 pb-1 border-b border-white/[0.06]" style={{ background: "hsl(260 30% 12%)" }}>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/30" />
                  <input
                    ref={inputRef}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar..."
                    className="h-8 w-full rounded-full border border-white/[0.08] bg-white/[0.04] pl-7 pr-3 text-[11px] text-white/70 outline-none focus:border-[hsl(var(--task-purple)/0.4)] placeholder:text-white/25"
                  />
                </div>
              </div>
            )}
            <div className="overflow-y-auto flex-1 p-1.5">
              {/* Select all / clear */}
              <button
                onClick={() => { onChange([]); setSearch(""); }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-[12px] font-semibold transition ${
                  isAll ? "bg-[hsl(var(--task-purple)/0.15)] text-white/90" : "text-white/40 hover:bg-white/[0.05] hover:text-white/60"
                }`}
              >
                {placeholder}
              </button>

              {mineSet && sortedOptions.length > 0 && (
                <>
                  {sortedOptions.some(o => mineSet.has(o.value)) && (
                    <div className="px-3 pt-2 pb-1 text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--task-purple)/0.6)]">Projetos que faço parte</div>
                  )}
                  {sortedOptions.filter(o => mineSet.has(o.value)).map((o) => renderOption(o, true))}
                  {sortedOptions.some(o => !mineSet.has(o.value)) && (
                    <div className="px-3 pt-3 pb-1 text-[9px] font-bold uppercase tracking-widest text-white/20">Outros</div>
                  )}
                  {sortedOptions.filter(o => !mineSet.has(o.value)).map((o) => renderOption(o))}
                </>
              )}

              {!mineSet && sortedOptions.map((o) => renderOption(o))}

              {sortedOptions.length === 0 && search.trim() && (
                <p className="px-3 py-4 text-center text-[11px] text-white/30">Nenhum resultado</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

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

  const activeCount =
    (status !== "all" ? 1 : 0) +
    (period !== "all" ? 1 : 0) +
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
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl border px-4 py-[9px] text-[13px] font-semibold transition ${
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
            className="overflow-visible w-full"
          >
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-end justify-center gap-3 sm:gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 sm:p-4 overflow-visible">
              {/* Status */}
              <div className="space-y-1.5 w-full sm:w-auto">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Status</label>
                <div className="flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1 overflow-x-auto">
                  {statusChips.map((chip) => (
                    <button
                      key={chip.value}
                      type="button"
                      onClick={() => setStatus(chip.value)}
                      className={`rounded-xl px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-[12px] font-semibold transition-all whitespace-nowrap ${
                        status === chip.value
                          ? "bg-[hsl(var(--task-purple))] text-white shadow"
                          : "text-white/30 hover:text-white/50"
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Period dropdown */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Período</label>
                <CustomSelect
                  value={period}
                  onChange={setPeriod}
                  options={periodChips.map(c => ({ value: c.value, label: c.label }))}
                  placeholder="Todos períodos"
                  icon={Calendar}
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
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="h-9 rounded-xl border border-white/[0.08] bg-[hsl(var(--task-surface))] px-2.5 text-xs text-white/70 outline-none"
                    />
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="h-9 rounded-xl border border-white/[0.08] bg-[hsl(var(--task-surface))] px-2.5 text-xs text-white/70 outline-none"
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
                    className="flex h-9 items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-[12px] font-semibold text-white/40 hover:text-white/60 hover:border-white/[0.15] transition"
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
