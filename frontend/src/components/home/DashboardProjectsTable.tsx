import { memo, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FolderKanban, Search, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatHoursHuman } from "@/modules/tasks/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ProjectAnalytics } from "@/modules/analytics/types";

type Props = {
  projects: ProjectAnalytics[];
  loading?: boolean;
};

const perfBadge = {
  good: { label: "Bom", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
  neutral: { label: "Regular", className: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
  bad: { label: "Atenção", className: "bg-rose-500/15 text-rose-400 border-rose-500/20" },
};

function DashboardProjectsTableInner({ projects, loading }: Props) {
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);
  const INITIAL_COUNT = isMobile ? 5 : 8;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = q
      ? projects.filter(
          (p) =>
            p.projectName.toLowerCase().includes(q) ||
            p.clientName?.toLowerCase().includes(q)
        )
      : projects;
    return [...list].sort((a, b) => {
      // Active first, then by total tasks desc
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      const aTotal = a.tasksDone + a.tasksPending + a.tasksOverdue;
      const bTotal = b.tasksDone + b.tasksPending + b.tasksOverdue;
      return bTotal - aTotal;
    });
  }, [projects, search]);

  const visible = expanded ? filtered : filtered.slice(0, INITIAL_COUNT);

  return (
    <div className="rounded-2xl border border-border/12 bg-card/40 backdrop-blur-sm overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/8 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <FolderKanban className="h-3.5 w-3.5 text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Projetos</h3>
          <span className="text-[10px] text-muted-foreground">({projects.length})</span>
        </div>
        <div className="relative w-full sm:w-52">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar projeto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border/20 bg-white/[0.04] py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>
      </div>

      <div className="p-0">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="h-4 w-40 rounded bg-white/[0.04] animate-pulse" />
                <div className="h-4 w-16 rounded bg-white/[0.04] animate-pulse" />
                <div className="h-4 w-12 rounded bg-white/[0.04] animate-pulse" />
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
            Nenhum projeto encontrado
          </div>
        ) : (
          <>
            {/* Header row — hidden on mobile */}
            <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-2 text-[10px] font-semibold text-white/30 uppercase tracking-wider border-b border-border/6">
              <div className="col-span-4">Projeto</div>
              <div className="col-span-2 text-center">Status</div>
              <div className="col-span-1 text-center">✓</div>
              <div className="col-span-1 text-center">⏳</div>
              <div className="col-span-1 text-center">⚠</div>
              <div className="col-span-2 text-center">Horas</div>
              <div className="col-span-1 text-center">Perf.</div>
            </div>

            {visible.map((p, i) => {
              const total = p.tasksDone + p.tasksPending + p.tasksOverdue;
              const badge = perfBadge[p.performance];
              return (
                <motion.div
                  key={p.projectId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.25 }}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-1 sm:gap-2 px-4 py-2.5 border-b border-border/6 last:border-b-0 hover:bg-white/[0.02] transition-colors"
                >
                  {/* Project name */}
                  <div className="sm:col-span-4 min-w-0">
                    <p className="text-xs font-medium text-white/80 truncate">{p.projectName}</p>
                    {p.clientName && (
                      <p className="text-[10px] text-white/30 truncate">{p.clientName}</p>
                    )}
                  </div>

                  {/* Mobile: inline stats */}
                  <div className="sm:hidden flex items-center gap-3 text-[11px] text-white/50">
                    <span className="text-emerald-400">✓ {p.tasksDone}</span>
                    <span className="text-amber-400">⏳ {p.tasksPending}</span>
                    {p.tasksOverdue > 0 && <span className="text-rose-400">⚠ {p.tasksOverdue}</span>}
                    {p.hoursUsed > 0 && <span className="text-white/40">{formatHoursHuman(p.hoursUsed)}</span>}
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${badge.className}`}>
                      {badge.label}
                    </Badge>
                  </div>

                  {/* Desktop columns */}
                  <div className="hidden sm:flex sm:col-span-2 items-center justify-center">
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1.5 py-0 ${p.isActive ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-white/[0.04] text-white/30 border-white/10"}`}
                    >
                      {p.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <div className="hidden sm:flex sm:col-span-1 items-center justify-center text-xs text-emerald-400 font-medium">
                    {p.tasksDone}
                  </div>
                  <div className="hidden sm:flex sm:col-span-1 items-center justify-center text-xs text-amber-400 font-medium">
                    {p.tasksPending}
                  </div>
                  <div className="hidden sm:flex sm:col-span-1 items-center justify-center text-xs font-medium" style={{ color: p.tasksOverdue > 0 ? "hsl(0 84% 60%)" : "hsl(0 0% 100% / 0.2)" }}>
                    {p.tasksOverdue}
                  </div>
                  <div className="hidden sm:flex sm:col-span-2 items-center justify-center text-xs text-white/50">
                    {p.hoursUsed > 0 ? formatHoursHuman(p.hoursUsed) : "—"}
                  </div>
                  <div className="hidden sm:flex sm:col-span-1 items-center justify-center">
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${badge.className}`}>
                      {badge.label}
                    </Badge>
                  </div>
                </motion.div>
              );
            })}

            {/* Show more/less */}
            {filtered.length > INITIAL_COUNT && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex w-full items-center justify-center gap-1.5 py-2.5 text-[11px] text-primary hover:text-primary/80 transition-colors"
              >
                {expanded ? (
                  <>Mostrar menos <ChevronUp className="h-3 w-3" /></>
                ) : (
                  <>Ver todos ({filtered.length}) <ChevronDown className="h-3 w-3" /></>
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default memo(DashboardProjectsTableInner);
