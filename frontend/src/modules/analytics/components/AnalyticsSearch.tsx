import { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import type { ProjectAnalytics } from "../types";

type Props = {
  projects: ProjectAnalytics[];
  onSelect: (project: ProjectAnalytics | null) => void;
  selected: ProjectAnalytics | null;
};

export default function AnalyticsSearch({ projects, onSelect, selected }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? projects.filter(
        (p) =>
          p.projectName.toLowerCase().includes(query.toLowerCase()) ||
          p.clientName.toLowerCase().includes(query.toLowerCase())
      )
    : projects;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative w-[280px]">
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-white/30" />
        <input
          value={selected ? selected.projectName : query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (selected) onSelect(null);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar projeto ou cliente..."
          className="h-[38px] w-full rounded-xl border border-white/[0.06] bg-white/[0.03] pl-9 pr-7 text-[13px] font-semibold text-white/50 placeholder:text-white/30 outline-none transition hover:border-white/[0.12] hover:text-white/70 focus:border-[hsl(262_83%_58%/0.4)] focus:bg-[hsl(262_83%_58%/0.1)] focus:text-[hsl(262_83%_58%)]"
        />
        {(query || selected) && (
          <button
            onClick={() => { setQuery(""); onSelect(null); setOpen(false); }}
            className="absolute right-3 text-white/30 hover:text-white/60 transition"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && filtered.length > 0 && !selected && (
        <div
          className="absolute z-50 mt-1.5 w-full rounded-xl border border-white/[0.08] shadow-2xl max-h-[280px] overflow-y-auto styled-scrollbar"
          style={{ background: "linear-gradient(145deg, hsl(270 50% 12%), hsl(234 45% 8%))" }}
        >
          {filtered.slice(0, 15).map((p) => (
            <button
              key={p.projectId}
              onClick={() => { onSelect(p); setOpen(false); setQuery(""); }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-white/[0.04] transition"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-white/80">{p.projectName}</p>
                <p className="truncate text-xs text-white/30">{p.clientName}</p>
              </div>
              {p.isActive && (
                <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                  Ativo
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
