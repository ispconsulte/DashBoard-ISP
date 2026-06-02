import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// z-[200]: dropdowns must sit above Radix Dialogs (z-50) and the filter panel
// (z-[100]) so that options remain visible when opened inside a stacked layout.
const DROPDOWN_Z = "z-[200]";

export type DropdownOption = { value: string; label: string };

type BaseDropdownProps = {
  placeholder: string;
  icon?: React.ComponentType<{ className?: string }>;
  mineSet?: Set<string>;
  /** CSS custom-property token name for the accent colour, e.g. "--task-purple" */
  accentVar?: string;
  /** CSS custom-property token name for the surface/background colour, e.g. "--task-surface" */
  surfaceVar?: string;
};

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onClose]);
}

function DropdownPanel({
  open,
  children,
  surfaceVar = "--task-surface",
  maxHeight = "min(300px,70vh)",
  width = "min(240px,calc(100vw-1.5rem))",
}: {
  open: boolean;
  children: React.ReactNode;
  surfaceVar?: string;
  maxHeight?: string;
  width?: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -4, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.97 }}
          transition={{ duration: 0.15 }}
          className={`absolute left-0 sm:right-0 sm:left-auto top-full ${DROPDOWN_Z} mt-1 rounded-2xl border border-white/[0.08] shadow-xl shadow-black/50 overflow-hidden flex flex-col`}
          style={{
            background: `hsl(var(${surfaceVar}))`,
            maxHeight,
            width,
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SearchInput({
  value,
  onChange,
  inputRef,
  surfaceVar = "--task-surface",
  accentVar = "--task-purple",
}: {
  value: string;
  onChange: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  surfaceVar?: string;
  accentVar?: string;
}) {
  return (
    <div
      className="shrink-0 px-1.5 pt-1.5 pb-1 border-b border-white/[0.06]"
      style={{ background: `hsl(var(${surfaceVar}))` }}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/30" />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Buscar..."
          className={`h-8 w-full rounded-full border border-white/[0.08] bg-white/[0.04] pl-7 pr-3 text-[11px] text-white/70 outline-none focus:border-[hsl(var(${accentVar})/0.4)] placeholder:text-white/25`}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   CustomSelect — single-value searchable dropdown
───────────────────────────────────────────────────────────── */
export function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
  icon: Icon,
  mineSet,
  accentVar = "--task-purple",
  surfaceVar = "--task-surface",
  subtleSelection = false,
}: BaseDropdownProps & {
  value: string;
  onChange: (v: string) => void;
  options: DropdownOption[];
  /** When true, the active option is not highlighted in the accent colour —
   *  the dropdown opens "neutral" (only a discreet check marks the current
   *  value). Used for the always-defaulted Base de data / Período filters so
   *  they don't look pre-selected. */
  subtleSelection?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useClickOutside(ref, () => { setOpen(false); setSearch(""); });

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const isActive = Boolean(value && value !== "all");
  // The placeholder doubles as the "all/default" reset entry rendered as a fixed
  // top button. Suppress it whenever the options list already represents that
  // entry — either via an explicit "all" value (Status/Período) or because the
  // placeholder text matches an existing option (Base de data) — otherwise the
  // same label would appear twice (fixed button + list item).
  const hasResetOption = options.some((o) => o.value === "all" || o.label === placeholder);

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

  const mine = mineSet ? sortedOptions.filter((o) => mineSet.has(o.value)) : [];
  const others = mineSet ? sortedOptions.filter((o) => !mineSet.has(o.value)) : sortedOptions;

  return (
    <div ref={ref} className="relative w-full sm:w-auto">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex min-h-[44px] h-9 w-full sm:w-auto sm:min-w-[170px] items-center gap-2 rounded-xl border px-3 text-[12px] font-semibold transition-all ${
          isActive && !subtleSelection
            ? `border-[hsl(var(${accentVar})/0.4)] bg-[hsl(var(${accentVar})/0.1)] text-white/80`
            : `border-white/[0.08] bg-[hsl(var(${surfaceVar}))] text-white/50`
        } hover:border-white/[0.15]`}
      >
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0 opacity-50" />}
        <span className="flex-1 truncate text-left">{selected?.label || placeholder}</span>
        <ChevronDown className={`h-3 w-3 shrink-0 opacity-40 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <DropdownPanel open={open} surfaceVar={surfaceVar} maxHeight="min(260px,70vh)" width="min(220px,calc(100vw-1.5rem))">
        {options.length > 5 && (
          <SearchInput value={search} onChange={setSearch} inputRef={inputRef} surfaceVar={surfaceVar} accentVar={accentVar} />
        )}
        <div className="overflow-y-auto flex-1 p-1.5 flex flex-col gap-0.5">
          {!hasResetOption && (
            <button
              type="button"
              onClick={() => { onChange("all"); setOpen(false); setSearch(""); }}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold transition ${
                !isActive
                  ? `bg-[hsl(var(${accentVar})/0.15)] text-white/90`
                  : "text-white/40 hover:bg-white/[0.06] hover:text-white/60"
              }`}
            >
              {placeholder}
            </button>
          )}

          {mineSet && mine.length > 0 && (
            <>
              <div className={`px-3 pt-2 pb-0.5 text-[9px] font-bold uppercase tracking-widest text-[hsl(var(${accentVar})/0.6)]`}>
                Projetos que faço parte
              </div>
              {mine.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); setSearch(""); }}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold transition ${
                    value === o.value
                      ? `bg-[hsl(var(${accentVar})/0.15)] text-white/90`
                      : "text-white/50 hover:bg-white/[0.06] hover:text-white/70"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(${accentVar}))]`} />
                  <span className="truncate">{o.label}</span>
                </button>
              ))}
            </>
          )}

          {mineSet && others.length > 0 && (
            <div className="px-3 pt-2 pb-0.5 text-[9px] font-bold uppercase tracking-widest text-white/20">Outros</div>
          )}

          {(mineSet ? others : sortedOptions).map((o) => {
            const isCurrent = value === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); setSearch(""); }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold transition ${
                  isCurrent && !subtleSelection
                    ? `bg-[hsl(var(${accentVar})/0.15)] text-white/90`
                    : "text-white/40 hover:bg-white/[0.06] hover:text-white/60"
                }`}
              >
                <span className="flex-1 truncate text-left">{o.label}</span>
                {isCurrent && subtleSelection && (
                  <Check className={`h-3.5 w-3.5 shrink-0 text-[hsl(var(${accentVar}))]`} />
                )}
              </button>
            );
          })}

          {sortedOptions.length === 0 && search.trim() && (
            <p className="px-3 py-4 text-center text-[11px] text-white/30">Nenhum resultado</p>
          )}
        </div>
      </DropdownPanel>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   MultiSelectProjects — multi-value searchable dropdown
───────────────────────────────────────────────────────────── */
export function MultiSelectProjects({
  value,
  onChange,
  options,
  placeholder,
  icon: Icon,
  mineSet,
  accentVar = "--task-purple",
  surfaceVar = "--task-surface",
}: BaseDropdownProps & {
  value: string[];
  onChange: (v: string[]) => void;
  options: DropdownOption[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useClickOutside(ref, () => { setOpen(false); setSearch(""); });

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

  const mine = mineSet ? sortedOptions.filter((o) => mineSet.has(o.value)) : [];
  const others = mineSet ? sortedOptions.filter((o) => !mineSet.has(o.value)) : sortedOptions;

  const toggleOption = (v: string) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };

  const displayLabel = isAll
    ? placeholder
    : value.length === 1
      ? (options.find((o) => o.value === value[0])?.label ?? placeholder)
      : `${value.length} projetos`;

  const renderOption = (o: DropdownOption, showDot?: boolean) => {
    const isSelected = value.includes(o.value);
    return (
      <button
        key={o.value}
        type="button"
        onClick={(e) => { e.preventDefault(); toggleOption(o.value); }}
        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold transition ${
          isSelected
            ? `bg-[hsl(var(${accentVar})/0.12)] border border-[hsl(var(${accentVar})/0.25)] text-white/90`
            : "border border-transparent text-white/40 hover:bg-white/[0.06] hover:text-white/60"
        }`}
      >
        <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition ${
          isSelected
            ? `border-[hsl(var(${accentVar}))] bg-[hsl(var(${accentVar}))]`
            : "border-white/20 bg-transparent"
        }`}>
          {isSelected && (
            <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        {showDot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(${accentVar}))]`} />}
        <span className="truncate">{o.label}</span>
      </button>
    );
  };

  return (
    <div ref={ref} className="relative w-full sm:w-auto">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex min-h-[44px] h-9 w-full sm:w-auto sm:min-w-[170px] items-center gap-2 rounded-xl border px-3 text-[12px] font-semibold transition-all ${
          !isAll
            ? `border-[hsl(var(${accentVar})/0.4)] bg-[hsl(var(${accentVar})/0.1)] text-white/80`
            : `border-white/[0.08] bg-[hsl(var(${surfaceVar}))] text-white/50`
        } hover:border-white/[0.15]`}
      >
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0 opacity-50" />}
        <span className="flex-1 truncate text-left">{displayLabel}</span>
        {!isAll && (
          <span className={`rounded-full bg-[hsl(var(${accentVar}))] px-1.5 py-0.5 text-[10px] font-bold text-white`}>
            {value.length}
          </span>
        )}
        <ChevronDown className={`h-3 w-3 shrink-0 opacity-40 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <DropdownPanel open={open} surfaceVar={surfaceVar} maxHeight="min(300px,70vh)" width="min(260px,calc(100vw-1.5rem))">
        {options.length > 5 && (
          <SearchInput value={search} onChange={setSearch} inputRef={inputRef} surfaceVar={surfaceVar} accentVar={accentVar} />
        )}
        <div className="overflow-y-auto flex-1 p-1.5 flex flex-col gap-0.5">
          <button
            type="button"
            onClick={() => { onChange([]); setSearch(""); }}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold transition ${
              isAll
                ? `bg-[hsl(var(${accentVar})/0.15)] text-white/90`
                : "text-white/40 hover:bg-white/[0.06] hover:text-white/60"
            }`}
          >
            {placeholder}
          </button>

          {mineSet && mine.length > 0 && (
            <>
              <div className={`px-3 pt-2 pb-0.5 text-[9px] font-bold uppercase tracking-widest text-[hsl(var(${accentVar})/0.6)]`}>
                Projetos que faço parte
              </div>
              {mine.map((o) => renderOption(o, true))}
            </>
          )}

          {mineSet && others.length > 0 && (
            <div className="px-3 pt-2 pb-0.5 text-[9px] font-bold uppercase tracking-widest text-white/20">Outros</div>
          )}

          {(mineSet ? others : sortedOptions).map((o) => renderOption(o))}

          {sortedOptions.length === 0 && search.trim() && (
            <p className="px-3 py-4 text-center text-[11px] text-white/30">Nenhum resultado</p>
          )}
        </div>
      </DropdownPanel>
    </div>
  );
}
