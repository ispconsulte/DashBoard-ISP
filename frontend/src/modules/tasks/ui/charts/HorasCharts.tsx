import React, { useMemo, useState } from "react";
import { formatHoursHuman } from "@/modules/tasks/utils";
import EmptyState from "@/components/ui/EmptyState";
import type { TooltipProps } from "recharts";
import {
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  LabelList,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
  Cell,
} from "recharts";
import { Info, X, Clock, Users, FolderKanban } from "lucide-react";
import type { TaskView } from "@/modules/tasks/types";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Gráficos da página "Relatório de Horas".
 * Foco: tempo gasto — quem trabalhou quanto, em quais projetos e a evolução no tempo.
 * Mantido separado do TaskCharts (usado em /tarefas) para que cada página tenha seu próprio código.
 */

type BarProject = { name: string; hours: number; count?: number };

type Props = {
  tasks: TaskView[];
  /** Horas por projeto já agregadas pela página (mesmo cálculo da lista). */
  barProjectsOverride?: BarProject[];
  loading?: boolean;
  onPickConsultant?: (name: string) => void;
  onPickProject?: (name: string) => void;
};

const COLORS = ["#0ea5e9", "#6366f1", "#22c55e", "#8b5cf6", "#06b6d4", "#3b82f6", "#64748b", "#0891b2"];

// Permite ao tooltip "escapar" da área do gráfico para não ser cortado pela
// borda do card. z-index alto garante que fique por cima.
const tooltipWrapperStyle: React.CSSProperties = { zIndex: 50, pointerEvents: "none" };

// Estilo do tooltip padrão (usado no gráfico de área "Evolução de Horas").
const tooltipStyle: React.CSSProperties = {
  background: "hsl(228 25% 8%)",
  border: "1px solid hsl(228 20% 18%)",
  borderRadius: 10,
  fontSize: 12,
  color: "#e2e8f0",
  boxShadow: "0 8px 30px -8px rgba(0,0,0,0.6)",
  padding: "6px 10px",
};

/**
 * Tooltip customizado e enxuto para as barras de horas.
 * Mostra só horas (destaque) + nº de tarefas — sem repetir o nome do eixo,
 * sem bullet e sem o "nome: valor" padrão do recharts.
 */
function HoursBarTooltip(props: { active?: boolean; payload?: Array<{ value?: number; payload?: { hours?: number; count?: number } }> }) {
  const { active, payload } = props;
  if (!active || !payload || !payload.length) return null;
  const p = payload[0]?.payload ?? {};
  const hours = Number(p.hours ?? payload[0]?.value ?? 0);
  const count = Number(p.count ?? 0);
  return (
    <div
      style={{
        background: "hsl(228 25% 8%)",
        border: "1px solid hsl(228 20% 18%)",
        borderRadius: 10,
        boxShadow: "0 8px 30px -8px rgba(0,0,0,0.6)",
        padding: "6px 10px",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ color: "#f1f5f9", fontSize: 12, fontWeight: 700 }}>{formatHoursHuman(hours)}</span>
      {count > 0 && (
        <span style={{ color: "#94a3b8", fontSize: 11, marginLeft: 6 }}>
          · {count} tarefa{count === 1 ? "" : "s"}
        </span>
      )}
    </div>
  );
}

/** Agrupa horas (durationSeconds) por responsável, top N. */
function groupHoursByConsultant(tasks: TaskView[], topN: number) {
  const map = new Map<string, { seconds: number; count: number }>();
  tasks.forEach((t) => {
    const name = (t.consultant || "").trim() || "Sem responsável";
    const seconds = typeof t.durationSeconds === "number" ? Math.max(0, t.durationSeconds) : 0;
    const cur = map.get(name) ?? { seconds: 0, count: 0 };
    cur.seconds += seconds;
    cur.count += 1;
    map.set(name, cur);
  });
  return [...map.entries()]
    .map(([name, { seconds, count }]) => ({ name, hours: seconds / 3600, count }))
    .sort((a, b) => b.hours - a.hours || b.count - a.count)
    .slice(0, topN);
}

function groupHoursByProject(tasks: TaskView[], topN: number) {
  const map = new Map<string, { seconds: number; count: number }>();
  tasks.forEach((t) => {
    const key = (t.project || "").trim() || "Sem projeto";
    const seconds = typeof t.durationSeconds === "number" ? Math.max(0, t.durationSeconds) : 0;
    const cur = map.get(key) ?? { seconds: 0, count: 0 };
    cur.seconds += seconds;
    cur.count += 1;
    map.set(key, cur);
  });
  return [...map.entries()]
    .map(([name, { seconds, count }]) => ({ name, hours: seconds / 3600, count }))
    .sort((a, b) => b.hours - a.hours || b.count - a.count)
    .slice(0, topN);
}

/**
 * Acumula horas por dia para a evolução temporal.
 * Regra de horas idêntica aos demais blocos (durationSeconds, clamp em 0).
 * Tarefas com horas > 0 mas sem data de referência NÃO são descartadas:
 * vão para o bucket "Sem prazo", garantindo que o total do gráfico bata
 * com o KPI "Horas Alocadas". A chave do dia usa data LOCAL (getFullYear/
 * getMonth/getDate) para não deslocar o dia no fuso BR.
 */
const NO_DEADLINE_KEY = "Sem prazo";

function groupHoursByDeadlineDay(tasks: TaskView[], limit: number) {
  const map = new Map<string, number>();
  let noDeadlineHours = 0;
  for (const t of tasks) {
    const seconds = typeof t.durationSeconds === "number" ? Math.max(0, t.durationSeconds) : 0;
    if (seconds <= 0) continue;
    const d = t.deadlineDate;
    if (!d) {
      noDeadlineHours += seconds / 3600;
      continue;
    }
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    map.set(key, (map.get(key) ?? 0) + seconds / 3600);
  }
  const arr = [...map.entries()]
    .map(([iso, hours]) => ({ iso, hours }))
    .sort((a, b) => a.iso.localeCompare(b.iso));
  const limited = arr.length > limit ? arr.slice(arr.length - limit) : arr;
  // Bucket "Sem prazo" sempre ao final, para não perder horas sem data.
  if (noDeadlineHours > 0) limited.push({ iso: NO_DEADLINE_KEY, hours: noDeadlineHours });
  return limited;
}

/* ─── Overlay de informação do gráfico (mesmo padrão dos gráficos de /tarefas) ─── */
type InfoKind = "consultants" | "projects" | "evolution";

function ChartInfoOverlay({
  show,
  onClose,
  title,
  description,
  kind,
  tasks,
}: {
  show: boolean;
  onClose: () => void;
  title: string;
  description: string;
  kind: InfoKind;
  tasks: TaskView[];
}) {
  const items = useMemo(() => {
    if (kind === "consultants") return groupHoursByConsultant(tasks, 8);
    if (kind === "projects") return groupHoursByProject(tasks, 8);
    return [];
  }, [kind, tasks]);

  const totalHours = useMemo(
    () => tasks.reduce((acc, t) => acc + (typeof t.durationSeconds === "number" ? Math.max(0, t.durationSeconds) : 0), 0) / 3600,
    [tasks]
  );

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          className="absolute inset-0 z-20 flex flex-col rounded-2xl overflow-hidden"
          style={{ background: "hsl(228 30% 9% / 0.98)", backdropFilter: "blur(8px)" }}
        >
          <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
            <h4 className="text-sm font-bold text-white/90">Sobre este gráfico</h4>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/50 hover:text-white/90 hover:bg-white/10 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto styled-scrollbar px-5 pb-5">
            <div className="space-y-2.5 text-[11px] text-white/60 leading-relaxed">
              <p><strong className="text-white/80">{title}</strong></p>
              <p className="text-white/50">{description}</p>
              <div className="flex items-center gap-1.5 rounded-lg bg-sky-500/10 border border-sky-500/15 px-3 py-2 text-sky-300">
                <Clock className="h-3.5 w-3.5" />
                <span className="font-bold">{formatHoursHuman(totalHours)}</span>
                <span className="text-sky-300/70">no total deste recorte</span>
              </div>
              {items.length > 0 && (
                <div className="space-y-1.5 mt-3">
                  {items.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2">
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
                        style={{ backgroundColor: `${COLORS[i % COLORS.length]}20`, color: COLORS[i % COLORS.length] }}
                      >
                        {d.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-white/80 truncate">{d.name}</p>
                        <span className="text-[10px] text-sky-300">{d.count} tarefa{d.count === 1 ? "" : "s"}</span>
                      </div>
                      <span className="text-sm font-bold text-white/90">{formatHoursHuman(d.hours)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ChartLoadingPlaceholder() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 py-6">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        className="h-5 w-5 rounded-full border-2 border-white/10 border-t-[hsl(220_90%_60%)]"
      />
      <p className="text-[10px] text-white/25">Carregando dados…</p>
    </div>
  );
}

export function HorasCharts({
  tasks,
  barProjectsOverride,
  loading: isLoading,
  onPickConsultant,
  onPickProject,
}: Props) {
  const [evolutionRange, setEvolutionRange] = useState<7 | 30>(30);
  const [showInfoConsultant, setShowInfoConsultant] = useState(false);
  const [showInfoProject, setShowInfoProject] = useState(false);
  const [showInfoEvolution, setShowInfoEvolution] = useState(false);

  const hoursByConsultant = useMemo(() => groupHoursByConsultant(tasks, 6), [tasks]);
  const hoursByProject = useMemo(() => {
    const base = barProjectsOverride && barProjectsOverride.length ? barProjectsOverride : groupHoursByProject(tasks, 8);
    return base.slice(0, 6);
  }, [tasks, barProjectsOverride]);
  const hoursEvolution = useMemo(() => groupHoursByDeadlineDay(tasks, evolutionRange), [tasks, evolutionRange]);

  const hoursLabel: NonNullable<React.ComponentProps<typeof LabelList>["formatter"]> = (value) =>
    formatHoursHuman(typeof value === "number" ? value : Number(value ?? 0));

  return (
    <div className="w-full overflow-x-hidden">
      {!tasks.length && (
        <div className="mb-4 task-card px-4 py-3 text-sm text-[hsl(var(--task-text-muted))]">
          Nenhuma tarefa neste recorte. Ajuste filtros ou recarregue a base.
        </div>
      )}

      <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 overflow-hidden">
        {/* Barra: Horas por Responsável */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="task-card relative flex flex-col min-h-0 min-w-0"
        >
          <button
            type="button"
            onClick={() => setShowInfoConsultant(true)}
            className="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-lg text-white/25 hover:text-white/60 hover:bg-white/[0.08] transition-all"
          >
            <Info className="h-4 w-4" />
          </button>
          <ChartInfoOverlay
            show={showInfoConsultant}
            onClose={() => setShowInfoConsultant(false)}
            title="Horas por Responsável"
            description="Total de horas trabalhadas por cada pessoa no recorte atual. Clique em uma barra para filtrar a lista por aquele responsável."
            kind="consultants"
            tasks={tasks}
          />
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(220_90%_60%/0.15)]">
              <Users className="h-3.5 w-3.5 text-[hsl(220_90%_66%)]" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[hsl(220_90%_66%)]">Horas por Responsável</p>
              <p className="mt-0.5 text-xs text-[hsl(var(--task-text-muted))] truncate">Quem mais dedicou tempo</p>
            </div>
          </div>
          <div className="h-[220px] min-w-0 overflow-visible">
            {hoursByConsultant.length ? (
              <ResponsiveContainer width="100%" height={220} minWidth={1} minHeight={1}>
                <BarChart data={hoursByConsultant} layout="vertical" barCategoryGap="35%" margin={{ top: 5, right: 48, bottom: 5, left: 5 }}>
                  <defs>
                    {hoursByConsultant.map((_, idx) => (
                      <linearGradient key={idx} id={`hConsGrad-${idx}`} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={COLORS[idx % COLORS.length]} stopOpacity={0.55} />
                        <stop offset="100%" stopColor={COLORS[idx % COLORS.length]} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 20% 14%)" horizontal={false} />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={(v: number) => formatHoursHuman(v)} />
                  <YAxis dataKey="name" type="category" tick={{ fill: "#94a3b8", fontSize: 10 }} width={96} tickFormatter={(v: string) => (v.length > 14 ? v.slice(0, 13) + "…" : v)} />
                  <Tooltip content={<HoursBarTooltip />} wrapperStyle={tooltipWrapperStyle} allowEscapeViewBox={{ x: true, y: true }} cursor={{ fill: "hsl(228 20% 10%)" }} />
                  <Bar dataKey="hours" radius={[0, 6, 6, 0]} barSize={18} minPointSize={14} isAnimationActive animationDuration={1200} className="cursor-pointer" onClick={(data: { name?: string; payload?: { name?: string } }) => { const name = String(data?.name ?? data?.payload?.name ?? ""); if (name) onPickConsultant?.(name); }}>
                    {hoursByConsultant.map((_, idx) => (<Cell key={idx} fill={`url(#hConsGrad-${idx})`} />))}
                    <LabelList dataKey="hours" position="right" formatter={hoursLabel} style={{ fill: "#e2e8f0", fontSize: 10, fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : isLoading ? (
              <ChartLoadingPlaceholder />
            ) : (
              <EmptyState variant="chart" compact className="h-full" />
            )}
          </div>
        </motion.div>

        {/* Barra: Horas por Projeto */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="task-card relative flex flex-col min-h-0 min-w-0"
        >
          <button
            type="button"
            onClick={() => setShowInfoProject(true)}
            className="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-lg text-white/25 hover:text-white/60 hover:bg-white/[0.08] transition-all"
          >
            <Info className="h-4 w-4" />
          </button>
          <ChartInfoOverlay
            show={showInfoProject}
            onClose={() => setShowInfoProject(false)}
            title="Horas por Projeto"
            description="Total de horas alocadas em cada projeto. Os projetos com mais horas aparecem primeiro. Clique em uma barra para filtrar."
            kind="projects"
            tasks={tasks}
          />
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(var(--task-purple)/0.15)]">
              <FolderKanban className="h-3.5 w-3.5 text-[hsl(var(--task-purple))]" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[hsl(var(--task-purple))]">Horas por Projeto</p>
              <p className="mt-0.5 text-xs text-[hsl(var(--task-text-muted))] truncate">Onde o tempo foi investido</p>
            </div>
          </div>
          <div className="h-[220px] min-w-0 overflow-visible">
            {hoursByProject.length ? (
              <ResponsiveContainer width="100%" height={220} minWidth={1} minHeight={1}>
                <BarChart data={hoursByProject} layout="vertical" barCategoryGap="35%" margin={{ top: 5, right: 48, bottom: 5, left: 5 }}>
                  <defs>
                    {hoursByProject.map((_, idx) => (
                      <linearGradient key={idx} id={`hProjGrad-${idx}`} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={COLORS[(idx + 2) % COLORS.length]} stopOpacity={0.55} />
                        <stop offset="100%" stopColor={COLORS[(idx + 2) % COLORS.length]} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 20% 14%)" horizontal={false} />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={(v: number) => formatHoursHuman(v)} />
                  <YAxis dataKey="name" type="category" tick={{ fill: "#94a3b8", fontSize: 10 }} width={110} tickFormatter={(v: string) => (v.length > 16 ? v.slice(0, 15) + "…" : v)} />
                  <Tooltip content={<HoursBarTooltip />} wrapperStyle={tooltipWrapperStyle} allowEscapeViewBox={{ x: true, y: true }} cursor={{ fill: "hsl(228 20% 10%)" }} />
                  <Bar dataKey="hours" radius={[0, 6, 6, 0]} barSize={18} minPointSize={14} isAnimationActive animationDuration={1200} className="cursor-pointer" onClick={(data: { name?: string; payload?: { name?: string } }) => { const name = String(data?.name ?? data?.payload?.name ?? ""); if (name) onPickProject?.(name); }}>
                    {hoursByProject.map((_, idx) => (<Cell key={idx} fill={`url(#hProjGrad-${idx})`} />))}
                    <LabelList dataKey="hours" position="right" formatter={hoursLabel} style={{ fill: "#e2e8f0", fontSize: 10, fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : isLoading ? (
              <ChartLoadingPlaceholder />
            ) : (
              <EmptyState variant="chart" compact className="h-full" />
            )}
          </div>
        </motion.div>

        {/* Área: Evolução de Horas */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="task-card relative flex flex-col min-h-0 min-w-0"
        >
          <button
            type="button"
            onClick={() => setShowInfoEvolution(true)}
            className="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-lg text-white/25 hover:text-white/60 hover:bg-white/[0.08] transition-all"
          >
            <Info className="h-4 w-4" />
          </button>
          <ChartInfoOverlay
            show={showInfoEvolution}
            onClose={() => setShowInfoEvolution(false)}
            title="Evolução de Horas"
            description="Distribuição das horas ao longo do tempo, usando a data de prazo das tarefas como referência. Use os botões 7d/30d para ajustar a janela."
            kind="evolution"
            tasks={tasks}
          />
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(190_90%_50%/0.15)]">
              <Clock className="h-3.5 w-3.5 text-[hsl(190_90%_55%)]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[hsl(190_90%_55%)]">Evolução de Horas</p>
              <p className="mt-0.5 text-xs text-[hsl(var(--task-text-muted))] truncate">Horas ao longo do tempo</p>
            </div>
            <div className="flex items-center gap-1 shrink-0 mr-8">
              {[7, 30].map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setEvolutionRange(range as 7 | 30)}
                  className={`rounded-lg px-2 py-1 text-[10px] font-bold transition ${
                    evolutionRange === range
                      ? "bg-sky-500/15 text-sky-300"
                      : "text-[hsl(var(--task-text-muted))] hover:text-sky-300"
                  }`}
                >
                  {range}d
                </button>
              ))}
            </div>
          </div>
          <div className="h-[220px] min-w-0 overflow-hidden">
            {hoursEvolution.length ? (
              <ResponsiveContainer width="100%" height={220} minWidth={1} minHeight={1}>
                <AreaChart data={hoursEvolution} margin={{ top: 20, right: 10, bottom: 10, left: 0 }}>
                  <defs>
                    <linearGradient id="hEvolFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 20% 14%)" />
                  <XAxis dataKey="iso" tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={(v: string) => (v === NO_DEADLINE_KEY ? "S/ prazo" : `${v.slice(8, 10)}/${v.slice(5, 7)}`)} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} width={38} tickFormatter={(v: number) => formatHoursHuman(v)} />
                  <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: "#e2e8f0" }} labelStyle={{ color: "#e2e8f0" }} formatter={(value) => [formatHoursHuman(typeof value === "number" ? value : Number(value ?? 0)), "Horas"]} labelFormatter={(label) => { const s = String(label ?? ""); return s === NO_DEADLINE_KEY ? NO_DEADLINE_KEY : `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`; }} />
                  <Area type="monotone" dataKey="hours" stroke="#0ea5e9" strokeWidth={2} fill="url(#hEvolFill)" isAnimationActive animationDuration={1500} />
                </AreaChart>
              </ResponsiveContainer>
            ) : isLoading ? (
              <ChartLoadingPlaceholder />
            ) : (
              <EmptyState variant="timeline" compact className="h-full" />
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
