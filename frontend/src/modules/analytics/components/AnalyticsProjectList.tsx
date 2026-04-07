import { useState, useMemo, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Clock,
  Star,
  Pencil,
  CheckCircle2,
  AlertTriangle,
  Search,
  X,
  Timer,
  FolderOpen,
  FileDown,
} from "lucide-react";
import type { ProjectAnalytics } from "../types";
import { exportClientPDF } from "@/lib/exportPdf";

type Props = {
  projects: ProjectAnalytics[];
  onToggleFavorite: (id: number) => void;
  onProjectClick?: (project: ProjectAnalytics) => void;
  onEditHours?: (project: ProjectAnalytics) => void;
  onEditClientHours?: (clientName: string, projects: ProjectAnalytics[]) => void;
  selectedProject: ProjectAnalytics | null;
  myProjectIds?: Set<number>;
  isAdmin?: boolean;
};

type Filter = "all" | "mine" | "active" | "favorites";

/** Normaliza string para chave de agrupamento: minúsculas, sem acento, só alfanumérico */
function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Retorna true se o valor parece um placeholder inválido de nome de cliente.
 * Cobre: strings vazias, entre colchetes ([NOME DO CLIENTE]), strings genéricas, etc.
 */
function isClientPlaceholder(raw: string | null | undefined): boolean {
  if (!raw) return true;
  const s = raw.trim();
  if (s.length < 2) return true;
  // Qualquer coisa entre colchetes: [NOME DO CLIENTE], [CLIENT], [N/A], etc.
  if (/^\[.*\]$/.test(s)) return true;
  // Palavras-chave genéricas (case-insensitive)
  const lower = s.toLowerCase();
  if (
    lower.includes("nome do cliente") ||
    lower.includes("[nome") ||
    lower === "cliente" ||
    lower === "sem cliente" ||
    lower === "n/a" ||
    lower === "-"
  ) return true;
  return false;
}

/**
 * Extrai o nome do cliente a partir do nome do projeto.
 * Prioridade:
 *  1. clientName real (não placeholder)
 *  2. Parte antes de " - " ou " <> " no nome do projeto
 *  3. Nome do projeto inteiro como label do cliente
 */
function resolveDisplayClient(p: ProjectAnalytics): { clientLabel: string; projectLabel: string } {
  const clientRaw = p.clientName?.trim();

  if (!isClientPlaceholder(clientRaw)) {
    return { clientLabel: clientRaw!, projectLabel: p.projectName };
  }

  // Tenta separar por " - " ou " <> "
  const SEPARATORS = [" - ", " <> "];
  for (const sep of SEPARATORS) {
    const idx = p.projectName.indexOf(sep);
    if (idx > 0) {
      return {
        clientLabel: p.projectName.slice(0, idx).trim(),
        projectLabel: p.projectName.slice(idx + sep.length).trim() || p.projectName,
      };
    }
  }

  // Sem separador — usa o nome do projeto como cliente
  return { clientLabel: p.projectName, projectLabel: p.projectName };
}

/** Agrupa projetos por cliente, mesclando variantes do mesmo nome.
 *  Grupos cujo displayLabel ainda seja um placeholder são descartados.
 *  Projetos com nomes iguais dentro do mesmo cliente são MESCLADOS (somando métricas),
 *  pois no IXC um mesmo projeto pode ter IDs distintos mas representar a mesma entidade. */
function groupByClient(projects: ProjectAnalytics[]) {
  const map = new Map<string, {
    displayLabel: string;
    projects: ProjectAnalytics[];
    labelsByProject: Map<number, string>;
  }>();

  projects.forEach((p) => {
    const { clientLabel, projectLabel } = resolveDisplayClient(p);
    // Segunda linha de defesa: se depois de tudo o label ainda é placeholder, pula
    if (isClientPlaceholder(clientLabel)) return;
    const clientKey = normalizeKey(clientLabel);

    if (!map.has(clientKey)) {
      map.set(clientKey, { displayLabel: clientLabel, projects: [], labelsByProject: new Map() });
    }
    const entry = map.get(clientKey)!;

    // Prefere label mais descritiva (mais longa ou em Title Case)
    if (
      clientLabel.length > entry.displayLabel.length ||
      (
        clientLabel.length === entry.displayLabel.length &&
        clientLabel !== clientLabel.toUpperCase() &&
        entry.displayLabel === entry.displayLabel.toUpperCase()
      )
    ) {
      entry.displayLabel = clientLabel;
    }

    // Se já existe projeto com MESMO projectId → pula (duplicata exata)
    if (entry.projects.find((ep) => ep.projectId === p.projectId)) return;

    // Se já existe projeto com MESMO NOME normalizado → MESCLA as métricas
    const projectNameKey = normalizeKey(projectLabel);
    const existingByName = entry.projects.find(
      (ep) => normalizeKey(entry.labelsByProject.get(ep.projectId) ?? ep.projectName) === projectNameKey
    );

    if (existingByName) {
      // Mescla: soma tarefas e horas, mantém o maior projectId como representativo
      existingByName.tasksDone    += p.tasksDone;
      existingByName.tasksPending += p.tasksPending;
      existingByName.tasksOverdue += p.tasksOverdue;
      existingByName.hoursUsed    += p.hoursUsed;
      if (p.hoursContracted > existingByName.hoursContracted) {
        existingByName.hoursContracted = p.hoursContracted;
      }
      existingByName.isActive = existingByName.isActive || p.isActive;
      existingByName.isFavorite = existingByName.isFavorite || p.isFavorite;
      // Recalcula performance após merge
      const total = existingByName.tasksDone + existingByName.tasksPending + existingByName.tasksOverdue;
      const overdueRate = total > 0 ? existingByName.tasksOverdue / total : 0;
      const completionRate = total > 0 ? existingByName.tasksDone / total : 0;
      existingByName.performance =
        overdueRate > 0.3 ? "bad" : completionRate > 0.6 ? "good" : "neutral";
      return;
    }

    // Projeto novo dentro do cliente
    entry.projects.push(p);
    entry.labelsByProject.set(p.projectId, projectLabel);
  });

  return new Map(
    [...map.entries()].sort(([, a], [, b]) =>
      // Ordena por número de projetos (decrescente), desempate pelo nome
      b.projects.length - a.projects.length || a.displayLabel.localeCompare(b.displayLabel, "pt-BR")
    )
  );
}

/** Card de projeto dentro do accordion */
function ProjectCard({
  project,
  projectLabel,
  onToggleFavorite,
  onClick,
  onEditHours,
  isMine,
  isAdmin,
}: {
  project: ProjectAnalytics;
  projectLabel: string;
  onToggleFavorite: (id: number) => void;
  onClick?: (p: ProjectAnalytics) => void;
  onEditHours?: (p: ProjectAnalytics) => void;
  isMine?: boolean;
  isAdmin?: boolean;
}) {
  const total = project.tasksDone + project.tasksPending + project.tasksOverdue;
  const pct = total > 0 ? Math.round((project.tasksDone / total) * 100) : 0;
  const hasHours = project.hoursContracted > 0;
  const hoursPct = hasHours ? Math.min(100, Math.round((project.hoursUsed / project.hoursContracted) * 100)) : 0;
  const hoursBarColor =
    hoursPct >= 90 ? "hsl(0 84% 60%)" :
    hoursPct >= 70 ? "hsl(43 97% 52%)" :
    "hsl(160 84% 39%)";
  const hoursRemaining = hasHours ? Math.round(project.hoursContracted - project.hoursUsed) : null;

  const statusColor =
    project.performance === "good" ? "hsl(160 84% 39%)" :
    project.performance === "bad"  ? "hsl(0 84% 60%)"   :
                                     "hsl(43 97% 52%)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative flex flex-col gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 transition-all hover:border-white/[0.12] hover:bg-white/[0.04] cursor-pointer"
      onClick={() => onClick?.(project)}
    >
      {/* Barra de status lateral */}
      <div
        className="absolute left-0 inset-y-3 w-[3px] rounded-full"
        style={{ background: statusColor }}
      />

      <div className="flex items-start justify-between gap-2 pl-2">
        {/* Nome do projeto */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white/85 leading-snug group-hover:text-white transition-colors break-words">
            {projectLabel}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {project.isActive && (
              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                Ativo
              </span>
            )}
            {isMine && (
              <span className="rounded-full bg-[hsl(262_83%_58%/0.15)] border border-[hsl(262_83%_58%/0.3)] px-2 py-0.5 text-[10px] font-bold text-[hsl(262_83%_75%)]">
                Meu
              </span>
            )}
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {isAdmin && (
            <button
              onClick={() => onEditHours?.(project)}
              className="rounded-lg p-1.5 text-white/20 hover:text-[hsl(262_83%_68%)] hover:bg-[hsl(262_83%_58%/0.1)] transition"
              title="Editar horas contratadas"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => onToggleFavorite(project.projectId)}
            className="rounded-lg p-1.5 transition hover:scale-110"
          >
            <Star
              className={`h-4 w-4 transition ${
                project.isFavorite ? "fill-amber-400 text-amber-400" : "text-white/20 hover:text-amber-400/60"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap items-center gap-3 pl-2">
        {/* Tarefas */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-sm font-bold text-emerald-400">{project.tasksDone}</span>
            <span className="text-[10px] text-white/30">concluídas</span>
          </div>
          <div className="flex items-center gap-1">
            <Timer className="h-3.5 w-3.5 text-[hsl(262_83%_68%)]" />
            <span className="text-sm font-bold text-[hsl(262_83%_68%)]">{project.tasksPending}</span>
            <span className="text-[10px] text-white/30">andamento</span>
          </div>
          {project.tasksOverdue > 0 && (
            <div className="flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
              <span className="text-sm font-bold text-red-400">{project.tasksOverdue}</span>
              <span className="text-[10px] text-white/30">atrasadas</span>
            </div>
          )}
        </div>

        {/* Progresso */}
        <div className="flex items-center gap-2 flex-1 min-w-[100px]">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${pct}%`,
                background: "linear-gradient(to right, hsl(262 83% 58%), hsl(234 89% 64%))",
              }}
            />
          </div>
          <span className="text-[11px] font-bold text-white/45 shrink-0">{pct}%</span>
        </div>
      </div>

      {/* Horas */}
      <div className="flex items-center gap-2 pl-2" onClick={(e) => e.stopPropagation()}>
        <Clock className="h-3.5 w-3.5 text-white/25 shrink-0" />
        <span className="text-sm font-semibold text-white/60">{Math.round(project.hoursUsed)}h</span>
        {hasHours && (
          <>
            <span className="text-xs text-white/25">/ {project.hoursContracted}h contratadas</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07] max-w-[100px]">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${hoursPct}%`, background: hoursBarColor }}
              />
            </div>
            {hoursRemaining !== null && (
              <span className={`text-[10px] font-bold shrink-0 ${hoursRemaining < 0 ? "text-red-400" : "text-white/30"}`}>
                {hoursRemaining < 0 ? `+${Math.abs(hoursRemaining)}h excedido` : `${hoursRemaining}h restam`}
              </span>
            )}
          </>
        )}
        {!hasHours && isAdmin && (
          <button
            onClick={() => onEditHours?.(project)}
            className="text-[10px] text-white/25 hover:text-[hsl(262_83%_68%)] transition"
          >
            + definir horas
          </button>
        )}
      </div>
    </motion.div>
  );
}

export default function AnalyticsProjectList({
  projects,
  onToggleFavorite,
  onProjectClick,
  onEditHours,
  onEditClientHours,
  selectedProject,
  myProjectIds,
  isAdmin,
}: Props) {
  const [sectionOpen, setSectionOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const myCount = useMemo(
    () => (myProjectIds ? projects.filter((p) => myProjectIds.has(p.projectId)).length : 0),
    [projects, myProjectIds]
  );

  const filtered = useMemo(() => {
    let list = selectedProject
      ? projects.filter((p) => p.projectId === selectedProject.projectId)
      : projects;
    if (filter === "active")    list = list.filter((p) => p.isActive);
    if (filter === "favorites") list = list.filter((p) => p.isFavorite);
    if (filter === "mine" && myProjectIds) list = list.filter((p) => myProjectIds.has(p.projectId));
    return [...list].sort((a, b) => {
      if (filter === "all" && myProjectIds) {
        const aM = myProjectIds.has(a.projectId);
        const bM = myProjectIds.has(b.projectId);
        if (aM !== bM) return aM ? -1 : 1;
      }
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      return b.hoursUsed - a.hoursUsed;
    });
  }, [projects, filter, selectedProject, myProjectIds]);

  const grouped = useMemo(() => groupByClient(filtered), [filtered]);

  // Filtra grupos pelo campo de busca (cliente ou projeto)
  const groupedFiltered = useMemo(() => {
    if (!search.trim()) return grouped;
    const q = search.toLowerCase().trim();
    const qNorm = normalizeKey(q);
    const result = new Map<string, typeof grouped extends Map<string, infer V> ? V : never>();
    grouped.forEach((val, key) => {
      const matchClient =
        val.displayLabel.toLowerCase().includes(q) || key.includes(qNorm);
      const matchProject = val.projects.some((p) =>
        (val.labelsByProject.get(p.projectId) ?? p.projectName).toLowerCase().includes(q)
      );
      if (matchClient || matchProject) {
        result.set(key, val);
      }
    });
    return result;
  }, [grouped, search]);

  const filtersConfig: { key: Filter; label: string; count: number }[] = [
    { key: "all",       label: "Todos",     count: projects.length },
    ...(myProjectIds && myCount > 0
      ? [{ key: "mine" as Filter, label: "Meus", count: myCount }]
      : []),
    { key: "active",    label: "Ativos",    count: projects.filter((p) => p.isActive).length },
    { key: "favorites", label: "Favoritos", count: projects.filter((p) => p.isFavorite).length },
  ];

  const toggleExpand = (clientKey: string) =>
    setExpandedClients((prev) => {
      const next = new Set(prev);
      next.has(clientKey) ? next.delete(clientKey) : next.add(clientKey);
      return next;
    });

  const totalGroups = groupedFiltered.size;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="overflow-hidden rounded-2xl border border-white/[0.06]"
      style={{ background: "linear-gradient(145deg, hsl(270 50% 14% / 0.7), hsl(234 45% 10% / 0.5))" }}
    >
      {/* ── Section toggle header ── */}
      <button
        onClick={() => setSectionOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 transition hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-2.5">
          <Building2 className="h-5 w-5 text-[hsl(262_83%_65%)]" />
          <h3 className="text-base font-bold text-white/90">Projetos por Cliente</h3>
          <span className="rounded-full border border-white/[0.08] bg-white/[0.05] px-2.5 py-0.5 text-xs font-bold text-white/45">
            {filtered.length}
          </span>
          <span className="rounded-full border border-white/[0.05] bg-white/[0.03] px-2.5 py-0.5 text-xs text-white/30">
            {totalGroups} cliente{totalGroups !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] transition hover:border-white/[0.1]">
          {sectionOpen
            ? <ChevronUp className="h-4 w-4 text-white/40" />
            : <ChevronDown className="h-4 w-4 text-white/40" />
          }
        </div>
      </button>

      {/* ── Collapsible content ── */}
      <AnimatePresence initial={false}>
        {sectionOpen && (
          <motion.div
            key="section-content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t border-white/[0.05] px-5 py-4">
              {!isAdmin ? (
                /* ── Em construção para não-admins ── */
                <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[hsl(262_83%_58%/0.2)] bg-[hsl(262_83%_58%/0.08)]">
                    <Building2 className="h-8 w-8 text-[hsl(262_83%_65%/0.6)]" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-base font-bold text-white/70">🚧 Em construção</h4>
                    <p className="text-sm text-white/40 max-w-md">
                      Aguarde as próximas atualizações! Em breve esta seção exibirá as horas contratadas de cada projeto por cliente.
                    </p>
                  </div>
                </div>
              ) : (
              <>
              {/* Explicação para o usuário */}
              <div className="rounded-xl border border-[hsl(262_83%_58%/0.15)] bg-[hsl(262_83%_58%/0.05)] px-4 py-3">
                <p className="text-[13px] leading-relaxed text-white/50">
                  <span className="font-semibold text-white/70">Como funciona:</span>{" "}
                  Cada grupo representa um <span className="text-[hsl(262_83%_68%)] font-medium">cliente</span> com seus respectivos projetos.
                  Clique em um cliente para expandir e ver os detalhes de cada projeto — tarefas concluídas, em andamento, atrasadas e horas trabalhadas.
                  Use os filtros abaixo para encontrar rapidamente o que procura.
                </p>
              </div>

              {/* Filtros rápidos */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex gap-1 rounded-xl border border-white/[0.07] bg-white/[0.03] p-1">
                  {filtersConfig.map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setFilter(f.key)}
                      className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
                        filter === f.key
                          ? "bg-gradient-to-r from-[hsl(262_83%_58%)] to-[hsl(234_89%_64%)] text-white shadow-lg shadow-[hsl(262_83%_58%/0.25)]"
                          : "text-white/30 hover:text-white/55"
                      }`}
                    >
                      {f.label}
                      <span className="opacity-50">{f.count}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Barra de busca */}
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center" aria-hidden>
                  <Search className="h-4 w-4 text-white/30" />
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por cliente ou projeto..."
                  className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] pl-10 pr-10 text-sm text-white/80 placeholder-white/25 outline-none transition focus:border-[hsl(262_83%_58%/0.45)] focus:bg-white/[0.06] focus:ring-1 focus:ring-[hsl(262_83%_58%/0.1)]"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-white/30 transition hover:text-white/60"
                    aria-label="Limpar busca"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Legenda visual */}
              <div className="flex flex-wrap items-center gap-4 rounded-lg border border-white/[0.05] bg-white/[0.02] px-4 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/25">Legenda:</span>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: "hsl(160 84% 39%)" }} />
                  <span className="text-[11px] text-white/40">Saudável</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: "hsl(43 97% 52%)" }} />
                  <span className="text-[11px] text-white/40">Atenção</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: "hsl(0 84% 60%)" }} />
                  <span className="text-[11px] text-white/40">Crítico</span>
                </div>
              </div>

              {/* Lista de clientes */}
              {groupedFiltered.size === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                  <FolderOpen className="h-10 w-10 text-white/15" />
                  <p className="text-sm text-white/30">
                    {search ? `Nenhum resultado para "${search}"` : "Nenhum projeto encontrado."}
                  </p>
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="text-xs text-[hsl(262_83%_68%)] hover:text-white transition"
                    >
                      Limpar busca
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {[...groupedFiltered.entries()].map(([groupKey, { displayLabel, projects: clientProjects, labelsByProject }]) => {
                    const isExpanded = expandedClients.has(groupKey);

                    const totalHours      = clientProjects.reduce((s, p) => s + p.hoursUsed, 0);
                    const totalContracted = clientProjects.reduce((s, p) => s + (p.hoursContracted || 0), 0);
                    const activeCount     = clientProjects.filter((p) => p.isActive).length;
                    const overdueCount    = clientProjects.reduce((s, p) => s + p.tasksOverdue, 0);
                    const doneCount       = clientProjects.reduce((s, p) => s + p.tasksDone, 0);
                    const totalTasks      = clientProjects.reduce((s, p) => s + p.tasksDone + p.tasksPending + p.tasksOverdue, 0);
                    const hoursPct        = totalContracted > 0 ? Math.min(100, Math.round((totalHours / totalContracted) * 100)) : 0;
                    const hoursBarColor   =
                      hoursPct >= 90 ? "hsl(0 84% 60%)" :
                      hoursPct >= 70 ? "hsl(43 97% 52%)" :
                      "hsl(160 84% 39%)";

                    const isSingleSelf =
                      clientProjects.length === 1 &&
                      labelsByProject.get(clientProjects[0].projectId) === displayLabel;

                    const overdueRatio = totalTasks > 0 ? overdueCount / totalTasks : 0;
                    const healthColor =
                      overdueRatio > 0.3 ? "hsl(0 84% 60%)" :
                      overdueRatio > 0.1 ? "hsl(43 97% 52%)" :
                      "hsl(160 84% 39%)";

                    return (
                      <div
                        key={groupKey}
                        className="overflow-hidden rounded-2xl border border-white/[0.07] transition-shadow hover:shadow-md hover:shadow-black/20"
                        style={{ background: "linear-gradient(160deg, hsl(270 50% 10% / 0.8), hsl(234 45% 7% / 0.65))" }}
                      >
                        <button
                          onClick={() => toggleExpand(groupKey)}
                          className="group flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-white/[0.02]"
                        >
                          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[hsl(262_83%_58%/0.22)] bg-[hsl(262_83%_58%/0.08)]">
                            <Building2 className="h-5 w-5 text-[hsl(262_83%_65%)]" />
                            <span
                              className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[hsl(234_45%_8%)]"
                              style={{ background: healthColor }}
                            />
                          </div>

                          <div className="flex flex-1 flex-col gap-2 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-base font-bold text-white/90 max-w-[260px]">
                                {displayLabel}
                              </span>
                              <span className="rounded-full border border-white/[0.07] bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-bold text-white/40">
                                {clientProjects.length} projeto{clientProjects.length !== 1 ? "s" : ""}
                              </span>
                              {activeCount > 0 && (
                                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400">
                                  {activeCount} ativo{activeCount !== 1 ? "s" : ""}
                                </span>
                              )}
                              {overdueCount > 0 && (
                                <span className="rounded-full border border-red-500/25 bg-red-500/10 px-2.5 py-0.5 text-[11px] font-bold text-red-400">
                                  {overdueCount} atrasada{overdueCount !== 1 ? "s" : ""}
                                </span>
                              )}
                              {totalContracted > 0 && hoursPct >= 80 && (
                                <span
                                  className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                                    hoursPct >= 100
                                      ? "border-red-500/30 bg-red-500/15 text-red-400"
                                      : "border-amber-500/30 bg-amber-500/15 text-amber-400"
                                  }`}
                                >
                                  <AlertTriangle className="h-3 w-3" />
                                  {hoursPct >= 100 ? "Horas esgotadas" : `${hoursPct}% das horas`}
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                              <div className="flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400/60" />
                                <span className="text-xs font-bold text-emerald-400/70">{doneCount}</span>
                                <span className="text-[10px] text-white/25">concluídas</span>
                              </div>
                              {overdueCount > 0 && (
                                <div className="flex items-center gap-1">
                                  <AlertTriangle className="h-3.5 w-3.5 text-red-400/60" />
                                  <span className="text-xs font-bold text-red-400/70">{overdueCount}</span>
                                  <span className="text-[10px] text-white/25">atrasadas</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2 min-w-[140px] flex-1 max-w-[220px]">
                                <Clock className="h-3 w-3 shrink-0 text-white/20" />
                                <span className="text-xs font-bold text-white/40 shrink-0">{Math.round(totalHours)}h</span>
                                {totalContracted > 0 && (
                                  <>
                                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                                      <div
                                        className="h-full rounded-full transition-all duration-700"
                                        style={{ width: `${hoursPct}%`, background: hoursBarColor }}
                                      />
                                    </div>
                                    <span className="text-[10px] font-bold text-white/30 shrink-0">/{Math.round(totalContracted)}h</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                void exportClientPDF({
                                  clientName: displayLabel,
                                  generatedBy: undefined,
                                  projects: clientProjects.map((p) => ({
                                    name: labelsByProject.get(p.projectId) ?? p.projectName,
                                    totalTasks: p.tasksDone + p.tasksPending + p.tasksOverdue,
                                    doneTasks: p.tasksDone,
                                    overdueTasks: p.tasksOverdue,
                                    hours: p.hoursUsed,
                                    hoursContracted: p.hoursContracted || 0,
                                  })),
                                });
                              }}
                              className="flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.04] px-2.5 py-1.5 text-xs font-bold text-white/30 transition hover:border-emerald-500/30 hover:bg-emerald-500/[0.07] hover:text-emerald-400"
                              title="Exportar relatório deste cliente em PDF"
                            >
                              <FileDown className="h-3.5 w-3.5" />
                            </button>
                            {isAdmin && onEditClientHours && !isSingleSelf && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditClientHours(displayLabel, clientProjects);
                                }}
                                className="flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-white/35 transition hover:border-[hsl(262_83%_58%/0.35)] hover:bg-[hsl(262_83%_58%/0.07)] hover:text-[hsl(262_83%_68%)]"
                                title="Definir horas para todos os projetos deste cliente"
                              >
                                <Clock className="h-3.5 w-3.5" />
                                Horas
                              </button>
                            )}
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] transition group-hover:border-white/[0.1]">
                              {isExpanded
                                ? <ChevronUp className="h-4 w-4 text-white/40 transition group-hover:text-white/65" />
                                : <ChevronDown className="h-4 w-4 text-white/40 transition group-hover:text-white/65" />
                              }
                            </div>
                          </div>
                        </button>

                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              key="content"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.22, ease: "easeInOut" }}
                              className="overflow-hidden"
                            >
                              <div
                                className="grid gap-3 border-t border-white/[0.05] p-4"
                                style={{
                                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 360px), 1fr))",
                                }}
                              >
                                {clientProjects.map((p) => (
                                  <ProjectCard
                                    key={p.projectId}
                                    project={p}
                                    projectLabel={
                                      isSingleSelf
                                        ? p.projectName
                                        : (labelsByProject.get(p.projectId) ?? p.projectName)
                                    }
                                    onToggleFavorite={onToggleFavorite}
                                    onClick={onProjectClick}
                                    onEditHours={onEditHours}
                                    isMine={myProjectIds?.has(p.projectId)}
                                    isAdmin={isAdmin}
                                  />
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}
              </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
