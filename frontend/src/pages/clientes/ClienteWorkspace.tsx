import { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, FileDown, FolderKanban, Inbox, Loader2, ChevronDown,
  Filter, Calendar, User, Building2, ChevronLeft, ChevronRight, Clock, X, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabaseExt } from "@/lib/supabase";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useTasks } from "@/modules/tasks/api/useTasks";
import { useElapsedTimes } from "@/modules/tasks/api/useElapsedTimes";
import { useProjectHours } from "@/modules/tasks/api/useProjectHours";
import { useAnalyticsData, classifyTask } from "@/modules/analytics/hooks/useAnalyticsData";
import AnalyticsKpiCards from "@/modules/analytics/components/AnalyticsKpiCards";
import AnalyticsProductivityPulse from "@/modules/analytics/components/AnalyticsProductivityPulse";
import AnalyticsVelocityChart from "@/modules/analytics/components/AnalyticsVelocityChart";
import { CustomSelect } from "@/modules/shared/FilterDropdowns";
import { TaskListTable } from "@/modules/tasks/ui/TaskListTable";
import { ActivityListSection } from "@/modules/tasks/ui/ActivityListSection";
import { taskViewFromRecord } from "@/modules/tasks/taskView";
import EmptyState from "@/components/ui/EmptyState";
import DataErrorCard from "@/components/ui/DataErrorCard";
import ExportPDFModal, { type PDFExportSelection, type TaskIntegrityInfo } from "@/modules/analytics/components/ExportPDFModal";
import { toast } from "sonner";
import { exportTasksPDF } from "@/lib/exportPdf";
import { STATUS_LABELS } from "@/modules/tasks/types";
import { isOrgOfClient, normalizeForMatch } from "@/lib/clientMatch";
import { MIN_CUSTOM_FILTER_DATE } from "@/modules/tasks/customDateRange";
import type { TaskDateFilterMode } from "@/modules/tasks/taskDateFilter";
import { formatHoursHuman, getTaskDurationSeconds } from "@/modules/tasks/utils";
import type { TaskRecord, ElapsedTimeRecord } from "@/modules/tasks/types";

interface Cliente {
  cliente_id: number;
  nome: string;
  tipo_horas: string;
  horas_hg_contratadas: number | null;
  Ativo: boolean;
  horas_contratadas: number;
  horas_consumidas: number;
  logo_url: string | null;
  cidade: string | null;
  projetos_quantidade: number;
  status: string | null;
  created_at: string | null;
}

interface LinkedItem {
  id: number;
  name: string;
  type?: string | null;
  project?: boolean | null;
  cliente_id: number | null;
}

interface Props {
  cliente: Cliente;
  onBack: () => void;
}

type PeriodKey = "30d" | "90d" | "180d" | "all" | "custom";
type StatusKey = "all" | "done" | "pending" | "overdue";

const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "180d", label: "Últimos 180 dias" },
  { value: "all", label: "Todo histórico" },
  { value: "custom", label: "Personalizado" },
];
const PERIOD_DAYS: Record<Exclude<PeriodKey, "custom">, number> = { "30d": 30, "90d": 90, "180d": 180, all: 3650 };

const STATUS_OPTIONS: { value: StatusKey; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "done", label: "Concluídas" },
  { value: "pending", label: "Em andamento" },
  { value: "overdue", label: "Atrasadas" },
];

const statusStyle: Record<string, string> = {
  Ativo: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  Inativo: "bg-red-500/15 text-red-400 border-red-500/20",
  Suspenso: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  Cancelado: "bg-red-500/15 text-red-400 border-red-500/20",
};

function classifyItemType(item: Pick<LinkedItem, "type" | "project" | "name">): "Projeto" | "Collab" | "Grupo de Trabalho" {
  const rawType = String(item.type ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const rawName = String(item.name ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (rawType.includes("collab")) return "Collab";
  if (rawType.includes("grupo")) return "Grupo de Trabalho";
  if (rawType.includes("projeto")) return "Projeto";
  if (rawName.includes("grupo de trabalho") || rawName.startsWith("gt -") || rawName.startsWith("gt-") || rawName.startsWith("departamento") || rawName.startsWith("revops") || rawName.includes("projetos internos")) return "Grupo de Trabalho";
  if (rawName.includes("collab") || rawName.includes("<>")) return "Collab";
  return "Projeto";
}

const itemTypeBadge: Record<string, string> = {
  Collab: "bg-cyan-500/12 text-cyan-300 border-cyan-500/20",
  "Grupo de Trabalho": "bg-amber-500/12 text-amber-300 border-amber-500/20",
  Projeto: "bg-emerald-500/12 text-emerald-300 border-emerald-500/20",
};

function getResponsible(t: TaskRecord): string {
  return String(t.responsible_name ?? t.responsavel ?? t.consultant ?? t.owner ?? "").trim();
}

function getTaskDeadline(t: TaskRecord): string | null {
  const raw = t.deadline ?? t.due_date ?? t.dueDate ?? t.data;
  return raw ? String(raw) : null;
}

/**
 * Data de referência da tarefa para o recorte por período, conforme a base
 * escolhida no filtro. "elapsed_created_date" e "created_date" usam a criação;
 * "closed_date" usa o fechamento; "deadline" usa o prazo. Há fallback para a
 * criação quando o campo da base não existe, evitando excluir tarefas válidas.
 */
function getTaskReferenceDate(t: TaskRecord, mode: TaskDateFilterMode): string | null {
  const created = t.created_date ?? t.created_at;
  let primary: unknown = null;
  if (mode === "closed_date") primary = t.closed_date;
  else if (mode === "deadline") primary = getTaskDeadline(t);
  else primary = created; // elapsed_created_date | created_date
  const ref = primary ?? created ?? getTaskDeadline(t);
  return ref ? String(ref) : null;
}

export default function ClienteWorkspace({ cliente, onBack }: Props) {
  const { session } = useAuth();
  const accessToken = session?.accessToken;

  // ── Filtros do workspace ──
  const [period, setPeriod] = useState<PeriodKey>("all");
  const dateFilterMode: TaskDateFilterMode = "elapsed_created_date";
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");
  const [consultant, setConsultant] = useState("");
  const [orgFilter, setOrgFilter] = useState<string>(""); // project_id como string
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [orgsOpen, setOrgsOpen] = useState(false);
  const [orgSearch, setOrgSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // ── Organizações vinculadas (projetos, collabs, grupos de trabalho) ──
  const [items, setItems] = useState<LinkedItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [itemsError, setItemsError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoadingItems(true);
    setItemsError(null);
    try {
      const primary = await (supabaseExt as any)
        .from("projects")
        .select("id, name, type, project, cliente_id")
        .eq("cliente_id", cliente.cliente_id)
        .order("name", { ascending: true });
      let directData: LinkedItem[] = primary.data ?? [];
      if (primary.error) {
        const message = String(primary.error.message ?? "").toLowerCase();
        const missingCols = (message.includes("type") || message.includes("project")) && (message.includes("does not exist") || message.includes("column"));
        if (!missingCols) throw primary.error;
        const legacy = await (supabaseExt as any)
          .from("projects").select("id, name, cliente_id").eq("cliente_id", cliente.cliente_id).order("name", { ascending: true });
        if (legacy.error) throw legacy.error;
        directData = legacy.data ?? [];
      }

      // Auto-detecção: itens sem cliente cujo nome corresponde ao cliente.
      const orphans = await (supabaseExt as any)
        .from("projects")
        .select("id, name, type, project, cliente_id")
        .is("cliente_id", null)
        .order("name", { ascending: true });
      // Auto-detecção conservadora: respeita "DONO <> ESCOPO" para não puxar
      // clientes alheios (ex.: "New Wave <> ISP Consulte" não é da ISP Consulte).
      const detected: LinkedItem[] = (orphans.error ? [] : (orphans.data ?? [])).filter(
        (p: LinkedItem) => isOrgOfClient(p.name, cliente.nome),
      );

      const byId = new Map<number, LinkedItem>();
      [...directData, ...detected].forEach((p) => byId.set(p.id, p));
      setItems([...byId.values()].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e: any) {
      console.error("Erro ao carregar organizações do cliente:", e);
      setItemsError(e.message || "Erro ao carregar organizações vinculadas.");
    } finally {
      setLoadingItems(false);
    }
  }, [cliente.cliente_id, cliente.nome]);

  useEffect(() => { void fetchItems(); }, [fetchItems]);

  const clientProjectIds = useMemo(() => new Set(items.map((i) => i.id)), [items]);
  const itemNameById = useMemo(() => {
    const map = new Map<number, string>();
    items.forEach((i) => map.set(i.id, i.name));
    return map;
  }, [items]);

  // ── Dados (todo histórico; recorte de período é aplicado no cliente) ──
  const { tasks: allTasks, loading: loadingTasks, error: errorTasks, reload: reloadTasks } = useTasks({ accessToken, period: "all" });
  const { times, reload: reloadTimes } = useElapsedTimes({ accessToken, period: "all" });

  const { startIso, endIso } = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setFullYear(2000, 0, 1);
    start.setHours(0, 0, 0, 0);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  }, []);
  const { data: projectHours } = useProjectHours({ startIso, endIso, clientId: cliente.cliente_id });

  // Intervalo de datas do período selecionado (suporta "Personalizado").
  const periodRange = useMemo<{ start: Date | null; end: Date | null }>(() => {
    if (period === "all") return { start: null, end: null };
    if (period === "custom") {
      const start = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
      const end = dateTo ? new Date(`${dateTo}T23:59:59`) : null;
      return { start, end };
    }
    const start = new Date();
    start.setDate(start.getDate() - PERIOD_DAYS[period]);
    return { start, end: null };
  }, [period, dateFrom, dateTo]);

  // Tarefas do cliente (qualquer tipo de organização) com filtros aplicados.
  const clientTasks = useMemo(
    () => allTasks.filter((t) => clientProjectIds.has(Number(t.project_id))),
    [allTasks, clientProjectIds],
  );

  // Total de tarefas vinculadas ao cliente (todas as organizações), respeitando
  // apenas o filtro de organização — independe de período/status/consultor.
  const totalClientTasks = useMemo(() => {
    if (!orgFilter) return clientTasks.length;
    return clientTasks.filter((t) => Number(t.project_id) === Number(orgFilter)).length;
  }, [clientTasks, orgFilter]);

  // Consultores que realmente aparecem nas tarefas deste cliente.
  const consultants = useMemo(() => {
    const set = new Set<string>();
    clientTasks.forEach((t) => { const r = getResponsible(t); if (r) set.add(r); });
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [clientTasks]);

  const filteredTasks = useMemo(() => {
    return clientTasks.filter((t) => {
      if (orgFilter && Number(t.project_id) !== Number(orgFilter)) return false;
      if (consultant && getResponsible(t) !== consultant) return false;
      if (statusFilter !== "all" && classifyTask(t) !== statusFilter) return false;
      if (periodRange.start || periodRange.end) {
        const ref = getTaskReferenceDate(t, dateFilterMode);
        if (ref) {
          const d = new Date(ref);
          if (!Number.isNaN(d.getTime())) {
            if (periodRange.start && d < periodRange.start) return false;
            if (periodRange.end && d > periodRange.end) return false;
          }
        }
      }
      return true;
    });
  }, [clientTasks, orgFilter, consultant, statusFilter, periodRange, dateFilterMode]);

  // project_ids visíveis após filtros, para escopar horas/projetos analíticos.
  const visibleProjectIds = useMemo(() => {
    if (orgFilter) return new Set([Number(orgFilter)]);
    return clientProjectIds;
  }, [orgFilter, clientProjectIds]);

  const clientProjectHours = useMemo(
    () => projectHours.filter((ph) => visibleProjectIds.has(ph.projectId)),
    [projectHours, visibleProjectIds],
  );

  const { projects } = useAnalyticsData(filteredTasks, clientProjectHours, times);

  // ── Horas consumidas (a partir das tarefas filtradas + elapsed times) ──
  const elapsedByTask = useMemo(() => {
    const map = new Map<string, number>();
    times.forEach((tm) => {
      const id = tm.task_id;
      if (id == null) return;
      const key = String(id);
      map.set(key, (map.get(key) ?? 0) + (Number(tm.seconds ?? 0) || 0));
    });
    return map;
  }, [times]);

  const taskConsumedSeconds = useCallback((t: TaskRecord) => {
    const id = t.task_id ?? t.id;
    const fallback = id != null ? elapsedByTask.get(String(id)) : undefined;
    return getTaskDurationSeconds(t as Record<string, unknown>, fallback) ?? 0;
  }, [elapsedByTask]);

  const totals = useMemo(() => {
    const consumedSeconds = filteredTasks.reduce((sum, t) => sum + taskConsumedSeconds(t), 0);
    const consumedHours = consumedSeconds / 3600;
    const done = filteredTasks.filter((t) => classifyTask(t) === "done").length;
    const overdue = filteredTasks.filter((t) => classifyTask(t) === "overdue").length;
    const pending = filteredTasks.filter((t) => classifyTask(t) === "pending").length;
    return { consumedHours, done, overdue, pending, totalTasks: filteredTasks.length };
  }, [filteredTasks, taskConsumedSeconds]);

  // Horas contratadas/alocadas — total do cliente (escopo ao projeto se filtrado por org).
  const allocatedHours = Number(cliente.horas_contratadas || 0);
  const consumptionPct = allocatedHours > 0 ? Math.min(100, Math.round((totals.consumedHours / allocatedHours) * 100)) : 0;
  const remainingHours = allocatedHours - totals.consumedHours;
  const hoursExceeded = allocatedHours > 0 && totals.consumedHours > allocatedHours;
  // Cor do banco de horas por nível de consumo (verde→âmbar→laranja→vermelho).
  const hoursBar = useMemo(() => {
    const pctRaw = allocatedHours > 0 ? (totals.consumedHours / allocatedHours) * 100 : 0;
    if (hoursExceeded) return { bar: "bg-[linear-gradient(90deg,hsl(0_84%_55%),hsl(0_84%_45%))]", dot: "bg-red-400", text: "text-red-400", chipBg: "bg-red-500/15" };
    if (pctRaw >= 90) return { bar: "bg-[linear-gradient(90deg,hsl(25_95%_55%),hsl(18_90%_50%))]", dot: "bg-orange-400", text: "text-orange-400", chipBg: "bg-orange-500/15" };
    if (pctRaw >= 70) return { bar: "bg-[linear-gradient(90deg,hsl(38_92%_55%),hsl(32_90%_50%))]", dot: "bg-amber-400", text: "text-amber-400", chipBg: "bg-amber-500/15" };
    return { bar: "bg-[linear-gradient(90deg,hsl(234_89%_64%),hsl(200_75%_50%))]", dot: "bg-[hsl(200_75%_55%)]", text: "text-[hsl(200_75%_60%)]", chipBg: "bg-[hsl(200_75%_50%/0.15)]" };
  }, [allocatedHours, totals.consumedHours, hoursExceeded]);
  const activeProjects = useMemo(() => projects.filter((p) => p.isActive).length, [projects]);

  // Itens por tipo (filtrados pela busca normalizada), para a área colapsável.
  const itemsByType = useMemo(() => {
    const q = normalizeForMatch(orgSearch);
    const groups: Record<string, LinkedItem[]> = { Projeto: [], Collab: [], "Grupo de Trabalho": [] };
    items
      .filter((i) => !q || normalizeForMatch(i.name).includes(q))
      .forEach((i) => groups[classifyItemType(i)].push(i));
    return groups;
  }, [items, orgSearch]);
  const orgSearchTotal = useMemo(
    () => itemsByType.Projeto.length + itemsByType.Collab.length + itemsByType["Grupo de Trabalho"].length,
    [itemsByType],
  );

  const displayStatus = cliente.status || (cliente.Ativo ? "Ativo" : "Inativo");
  const hasData = items.length > 0 || clientTasks.length > 0;
  const loading = loadingItems || loadingTasks;
  const activeFilterCount = (period !== "all" ? 1 : 0) + (statusFilter !== "all" ? 1 : 0) + (consultant ? 1 : 0) + (orgFilter ? 1 : 0);
  const clearFilters = () => { setPeriod("all"); setStatusFilter("all"); setConsultant(""); setOrgFilter(""); setDateFrom(""); setDateTo(""); };

  // Mapa task_id -> segundos de elapsed (para horas reais na lista de atividades).
  const elapsedSecondsByTask = useMemo(() => {
    const map = new Map<string, number>();
    times.forEach((tm) => {
      if (tm.task_id == null) return;
      const key = String(tm.task_id);
      map.set(key, (map.get(key) ?? 0) + (Number(tm.seconds ?? 0) || 0));
    });
    return map;
  }, [times]);

  // Lista de atividades no MESMO padrão da tela de Tarefas (TaskListTable).
  // Os nomes das organizações vinculadas substituem o campo "projeto" para
  // refletir projetos, collabs e grupos de trabalho.
  const projectNameById = useMemo(() => {
    const map = new Map<string, string>();
    itemNameById.forEach((name, id) => map.set(String(id), name));
    return map;
  }, [itemNameById]);

  const activityViews = useMemo(() => {
    return [...filteredTasks]
      .map((t) => {
        const id = t.task_id ?? t.id;
        const elapsed = id != null ? elapsedSecondsByTask.get(String(id)) : undefined;
        return taskViewFromRecord(t, elapsed, projectNameById);
      })
      .sort((a, b) => {
        const order: Record<string, number> = { overdue: 0, pending: 1, unknown: 2, done: 3 };
        if (order[a.statusKey] !== order[b.statusKey]) return order[a.statusKey] - order[b.statusKey];
        const da = a.deadlineDate ? a.deadlineDate.getTime() : Infinity;
        const db = b.deadlineDate ? b.deadlineDate.getTime() : Infinity;
        return da - db;
      });
  }, [filteredTasks, elapsedSecondsByTask, projectNameById]);

  // Paginação (mesmo padrão da tela de Tarefas).
  const totalPages = Math.max(1, Math.ceil(activityViews.length / pageSize));
  const paginatedActivityViews = useMemo(() => {
    const start = (page - 1) * pageSize;
    return activityViews.slice(start, start + pageSize);
  }, [activityViews, page]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [period, statusFilter, consultant, orgFilter, dateFrom, dateTo]);

  // Lançamentos por tarefa para a seção expandida (Time Tracking) da TaskListTable.
  const timeEntriesByTaskId = useMemo(() => {
    const map: Record<string, ElapsedTimeRecord[]> = {};
    times.forEach((tm) => {
      if (tm.task_id == null) return;
      const key = String(tm.task_id);
      (map[key] ??= []).push(tm);
    });
    return map;
  }, [times]);

  // Iniciais do cliente para o avatar (mesmo estilo do card principal).
  const initials = useMemo(
    () => cliente.nome.split(" ").map((w) => w[0]).filter(Boolean).join("").toUpperCase().slice(0, 2),
    [cliente.nome],
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-5"
    >
      {/* ── Header redesenhado ── */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[linear-gradient(135deg,hsl(234_42%_13%/0.7),hsl(222_38%_8%/0.85)_55%,hsl(200_52%_10%/0.45))]">
        <div className="flex items-center gap-2 border-b border-white/[0.05] px-4 py-2.5 sm:px-5">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-white/55 transition-colors hover:bg-white/[0.06] hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar para clientes
          </button>
        </div>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-[1.5px] border-white/[0.12] shadow-lg shadow-black/25" style={{ borderColor: "hsl(234 89% 64% / 0.5)" }}>
              {cliente.logo_url ? (
                <img src={cliente.logo_url} alt={cliente.nome} className="h-full w-full object-cover object-center" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-base font-bold text-white" style={{ background: "linear-gradient(135deg, hsl(234 89% 64%), hsl(200 75% 50%))" }}>
                  {initials || <Building2 className="h-6 w-6 text-white/90" />}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-bold tracking-tight text-foreground">{cliente.nome}</h1>
                <Badge variant="outline" className={`shrink-0 text-[10px] px-1.5 py-0 leading-4 ${statusStyle[displayStatus] || "border-border/40 text-foreground"}`}>
                  {displayStatus}
                </Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/40">
                <span className="inline-flex items-center gap-1"><FolderKanban className="h-3 w-3" />{items.length} {items.length === 1 ? "organização" : "organizações"}</span>
                <span>{Math.round(allocatedHours)}h contratadas</span>
                {cliente.cidade && <span>· {cliente.cidade}</span>}
              </div>
            </div>
          </div>
          {hasData && (
            <Button
              size="sm"
              onClick={() => setShowExportModal(true)}
              className="h-10 shrink-0 gap-2 rounded-xl text-sm font-medium shadow-[0_14px_28px_-14px_hsl(234_89%_64%/0.7)]"
            >
              <FileDown className="h-4 w-4" />
              Exportar PDF
            </Button>
          )}
        </div>
      </div>

      {errorTasks && (
        <DataErrorCard compact title="Erro ao carregar analíticas" message={errorTasks} onRetry={() => { reloadTasks(); reloadTimes(); }} />
      )}
      {itemsError && (
        <DataErrorCard compact title="Erro ao carregar organizações vinculadas" message={itemsError} onRetry={fetchItems} />
      )}

      {/* ── Organizações vinculadas (colapsável, no topo) ── */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025]">
        <button
          onClick={() => setOrgsOpen((v) => !v)}
          className="flex w-full items-center gap-2 px-4 py-3 text-left transition hover:bg-white/[0.02]"
        >
          <FolderKanban className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-foreground">Organizações vinculadas</span>
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-bold text-white/55">{items.length}</span>
          <ChevronDown className={`ml-auto h-4 w-4 text-white/30 transition-transform ${orgsOpen ? "rotate-180" : ""}`} />
        </button>
        <AnimatePresence>
          {orgsOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <div className="space-y-3 border-t border-white/[0.05] p-4">
                {!loadingItems && items.length > 0 && (
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
                    <input
                      value={orgSearch}
                      onChange={(e) => setOrgSearch(e.target.value)}
                      placeholder="Buscar projeto, collab ou grupo..."
                      className="h-9 w-full rounded-xl border border-white/[0.07] bg-white/[0.03] pl-8 pr-8 text-xs text-foreground placeholder:text-white/30 outline-none transition focus:border-primary/40 focus:bg-white/[0.05]"
                    />
                    {orgSearch && (
                      <button
                        onClick={() => setOrgSearch("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                        aria-label="Limpar busca"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}
                {loadingItems ? (
                  <div className="flex items-center justify-center gap-2 py-4 text-xs text-white/40"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando...</div>
                ) : items.length === 0 ? (
                  <p className="py-4 text-center text-xs text-white/35">Nenhuma organização vinculada.</p>
                ) : orgSearchTotal === 0 ? (
                  <p className="py-4 text-center text-xs text-white/35">Nenhuma organização encontrada para “{orgSearch}”.</p>
                ) : (
                  (["Projeto", "Collab", "Grupo de Trabalho"] as const).map((type) =>
                    itemsByType[type].length > 0 ? (
                      <div key={type}>
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                          {type === "Grupo de Trabalho" ? "Grupos de Trabalho" : `${type}s`} ({itemsByType[type].length})
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {itemsByType[type].map((item) => {
                            const stats = projects.find((p) => p.projectId === item.id);
                            return (
                              <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-medium text-foreground">{item.name}</p>
                                  {stats && (
                                    <p className="mt-0.5 text-[10px] text-white/35">{formatHoursHuman(stats.hoursUsed)} · {stats.tasksDone + stats.tasksPending + stats.tasksOverdue} tarefas</p>
                                  )}
                                </div>
                                <Badge variant="outline" className={`shrink-0 border text-[9px] leading-none py-0.5 px-1.5 ${itemTypeBadge[type]}`}>
                                  {type === "Grupo de Trabalho" ? "Grupo" : type}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null,
                  )
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Filtros do workspace (dropdown abre/fecha, padrão Tarefas) ── */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025]">
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className="flex w-full items-center gap-2 px-4 py-3 text-left transition hover:bg-white/[0.02]"
        >
          <Filter className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-foreground">Filtros</span>
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">{activeFilterCount}</span>
          )}
          {activeFilterCount > 0 && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); clearFilters(); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); clearFilters(); } }}
              className="ml-auto cursor-pointer text-[11px] font-medium text-white/40 hover:text-white/70"
            >
              Limpar
            </span>
          )}
          <ChevronDown className={`${activeFilterCount > 0 ? "ml-2" : "ml-auto"} h-4 w-4 text-white/30 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
        </button>
        <AnimatePresence>
          {filtersOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: "visible" }}>
              <div className="grid grid-cols-1 gap-3 border-t border-white/[0.05] p-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Período</label>
                  <CustomSelect value={period} onChange={(v) => setPeriod((v || "all") as PeriodKey)} options={PERIOD_OPTIONS} placeholder="Todo histórico" icon={Calendar} subtleSelection />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Status</label>
                  <CustomSelect value={statusFilter} onChange={(v) => setStatusFilter((v || "all") as StatusKey)} options={STATUS_OPTIONS} placeholder="Todos" icon={Filter} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Consultor</label>
                  <CustomSelect
                    value={consultant}
                    onChange={setConsultant}
                    options={[{ value: "", label: "Todos os consultores" }, ...consultants.map((c) => ({ value: c, label: c }))]}
                    placeholder="Todos os consultores"
                    icon={User}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Organização</label>
                  <CustomSelect
                    value={orgFilter}
                    onChange={setOrgFilter}
                    options={[{ value: "", label: "Todas as organizações" }, ...items.map((i) => ({ value: String(i.id), label: i.name }))]}
                    placeholder="Todas as organizações"
                    icon={FolderKanban}
                    panelAlign="right"
                    panelWidth="min(360px,100%)"
                    panelMaxHeight="min(220px,45vh)"
                  />
                </div>
                {period === "custom" && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Intervalo</label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="date"
                        min={MIN_CUSTOM_FILTER_DATE}
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="min-h-[44px] h-9 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-[12px] font-semibold text-white/60 outline-none transition hover:border-white/[0.15] focus:border-primary/40 [color-scheme:dark]"
                      />
                      <input
                        type="date"
                        min={dateFrom || MIN_CUSTOM_FILTER_DATE}
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="min-h-[44px] h-9 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-[12px] font-semibold text-white/60 outline-none transition hover:border-white/[0.15] focus:border-primary/40 [color-scheme:dark]"
                      />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── KPIs (escopo do cliente) ── */}
      <AnalyticsKpiCards
        projectsLabel="Projetos Totais"
        secondCardTasks
        clients={orgFilter ? 1 : items.length}
        activeProjects={activeProjects}
        totalHours={allocatedHours}
        totalTasks={totalClientTasks}
        doneCount={totals.done}
        overdueCount={totals.overdue}
        loading={loading}
      />

      {/* ── Banco de horas: alocadas vs consumidas vs restantes ── */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[linear-gradient(135deg,hsl(234_45%_12%/0.6),hsl(222_40%_8%/0.7)_60%,hsl(200_50%_10%/0.4))]">
        <div className="flex items-center gap-2 border-b border-white/[0.05] px-4 py-2.5 sm:px-5">
          <Clock className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-foreground">Banco de horas</span>
          <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${hoursBar.text} ${hoursBar.chipBg}`}>
            {consumptionPct}% utilizado
          </span>
        </div>
        <div className="grid gap-px bg-white/[0.05] sm:grid-cols-3">
          <div className="bg-[hsl(222_40%_8%/0.4)] p-4 sm:p-5">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[hsl(234_89%_64%)]" />
              <p className="text-[11px] uppercase tracking-wider text-white/40">Alocadas</p>
            </div>
            <p className="mt-1.5 text-2xl font-bold text-foreground sm:text-3xl">{Math.round(allocatedHours)}<span className="text-base font-semibold text-white/40">h</span></p>
            <p className="mt-0.5 text-[11px] text-white/30">Contratadas para o cliente</p>
          </div>
          <div className="bg-[hsl(222_40%_8%/0.4)] p-4 sm:p-5">
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${hoursBar.dot}`} />
              <p className="text-[11px] uppercase tracking-wider text-white/40">Consumidas</p>
            </div>
            <p className="mt-1.5 text-2xl font-bold text-foreground sm:text-3xl">{formatHoursHuman(totals.consumedHours)}</p>
            <div className="mt-2.5 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                <motion.div initial={{ width: 0 }} animate={{ width: `${consumptionPct}%` }} transition={{ duration: 0.7, ease: "easeOut" }} className={`h-full rounded-full ${hoursBar.bar}`} />
              </div>
              <span className={`text-[11px] font-bold tabular-nums ${hoursBar.text}`}>{consumptionPct}%</span>
            </div>
          </div>
          <div className="bg-[hsl(222_40%_8%/0.4)] p-4 sm:p-5">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400/70" />
              <p className="text-[11px] uppercase tracking-wider text-white/40">Restantes</p>
            </div>
            <p className={`mt-1.5 text-2xl font-bold sm:text-3xl ${hoursExceeded ? "text-red-400" : "text-foreground"}`}>
              {allocatedHours > 0 ? (hoursExceeded ? `-${formatHoursHuman(Math.abs(remainingHours))}` : formatHoursHuman(remainingHours)) : "—"}
            </p>
            <p className="mt-0.5 text-[11px] text-white/30">{allocatedHours > 0 ? (hoursExceeded ? "Limite excedido" : "Saldo do contrato") : "Sem horas contratadas"}</p>
          </div>
        </div>
      </div>

      {/* ── Empty state ── */}
      {!loading && !hasData && (
        <EmptyState
          icon={Inbox}
          message="Nenhuma organização vinculada ou tarefa para este cliente."
          hint="Edite o cliente para vincular projetos, collabs ou grupos de trabalho."
        />
      )}

      {hasData && (
        <>
          {/* ── Pulso de produtividade + velocidade de entrega ── */}
          <div className="grid gap-5 lg:grid-cols-2 overflow-x-hidden">
            <AnalyticsProductivityPulse tasks={filteredTasks} classifyTask={classifyTask} />
            <AnalyticsVelocityChart tasks={filteredTasks} classifyTask={classifyTask} />
          </div>

          {/* ── Lista de atividades/tarefas do cliente (padrão Tarefas) ── */}
          <ActivityListSection
            total={activityViews.length}
            summary={
              <span>
                {formatHoursHuman(totals.consumedHours)} consumidas · {Math.round(allocatedHours)}h alocadas
              </span>
            }
          >
            {activityViews.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025]">
                <EmptyState compact icon={Inbox} message="Nenhuma tarefa para os filtros atuais." />
              </div>
            ) : (
              <>
                <TaskListTable tasks={paginatedActivityViews} timeEntriesByTaskId={timeEntriesByTaskId} />

                {activityViews.length > pageSize && (
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[hsl(var(--task-text-muted))]">
                    <span>
                      {Math.min((page - 1) * pageSize + 1, activityViews.length)}–{Math.min(page * pageSize, activityViews.length)} de {activityViews.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="rounded-lg border border-[hsl(var(--task-border))] p-1.5 transition hover:border-[hsl(var(--task-yellow)/0.4)] disabled:opacity-30"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="px-3 text-xs font-medium text-[hsl(var(--task-text))]">
                        {page} / {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="rounded-lg border border-[hsl(var(--task-border))] p-1.5 transition hover:border-[hsl(var(--task-yellow)/0.4)] disabled:opacity-30"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </ActivityListSection>
        </>
      )}

      {showExportModal && (
        <ExportPDFModal
          title={`Exportar Relatório — ${cliente.nome}`}
          onClose={() => setShowExportModal(false)}
          // Verificação de integridade usa as TAREFAS reais do cliente (mesma
          // base do relatório), não os projetos agregados.
          taskIntegrityData={activityViews.map((t): TaskIntegrityInfo => ({
            title: t.title,
            project: t.project,
            consultant: t.consultant,
            deadlineLabel: t.deadlineLabel,
            durationLabel: t.durationLabel,
            statusKey: t.statusKey,
          }))}
          onExport={async (sel: PDFExportSelection, incompleteAction) => {
            const EMPTY_MARKERS = ["sem título", "sem projeto", "sem consultor", "sem prazo", "sem registro", "sem status", "tarefa sem título", "projeto indefinido", ""];
            const isFieldEmpty = (v: string) => EMPTY_MARKERS.includes(v.trim().toLowerCase()) || v.trim() === "" || v.trim() === "—";
            const isTaskIncomplete = (t: (typeof activityViews)[number]) => {
              if (isFieldEmpty(t.title)) return true;
              if (isFieldEmpty(t.project)) return true;
              if (sel.includeResponsible && isFieldEmpty(t.consultant)) return true;
              if (sel.includeDeadline && isFieldEmpty(t.deadlineLabel)) return true;
              if (sel.includeDuration && isFieldEmpty(t.durationLabel)) return true;
              return false;
            };

            // Respeita os filtros de status escolhidos no modal.
            let tasksToExport = activityViews.filter((t) => {
              if (t.statusKey === "done" && !sel.includeDone) return false;
              if (t.statusKey === "overdue" && !sel.includeOverdue) return false;
              if ((t.statusKey === "pending" || t.statusKey === "unknown") && !sel.includePending) return false;
              return true;
            });
            if (incompleteAction === "exclude") {
              tasksToExport = tasksToExport.filter((t) => !isTaskIncomplete(t));
            } else if (incompleteAction === "only-incomplete") {
              tasksToExport = tasksToExport.filter((t) => isTaskIncomplete(t));
            }

            const rows = tasksToExport.map((t) => ({
              title: (t.title || "").trim() || "Sem título",
              project: (t.project || "").trim() || "Sem projeto",
              consultant: sel.includeResponsible ? ((t.consultant || "").trim() || "Sem responsável") : "—",
              consultantNameForHours: (t.consultant || "").trim() || "Sem responsável",
              statusLabel: STATUS_LABELS[t.statusKey]?.label || "Sem status",
              deadlineLabel: sel.includeDeadline ? ((t.deadlineLabel || "").trim() || "Sem prazo") : "—",
              durationLabel: sel.includeDuration ? ((t.durationLabel || "").trim() || "Sem registro") : "—",
              durationSeconds: t.durationSeconds ?? 0,
            }));

            if (rows.length === 0) {
              toast.warning("Nenhuma tarefa corresponde às opções selecionadas. Ajuste os filtros e tente novamente.");
              return;
            }

            // Mesmo gerador da tela de Tarefas: capa + gráficos (top responsáveis
            // e top projetos) + LISTA de tarefas agrupada por projeto. O título
            // fica fixo com o nome do cliente.
            await exportTasksPDF({
              title: `Relatório — ${cliente.nome}`,
              forceTitle: true,
              fileName: `relatorio-${cliente.nome.toLowerCase().replace(/[^a-z0-9]/g, "-")}.pdf`,
              tasks: rows,
              stats: {
                total: rows.length,
                done: rows.filter((r) => r.statusLabel === STATUS_LABELS.done?.label).length,
                overdue: rows.filter((r) => r.statusLabel === STATUS_LABELS.overdue?.label).length,
                pending: rows.filter((r) => r.statusLabel === STATUS_LABELS.pending?.label || r.statusLabel === STATUS_LABELS.unknown?.label).length,
                totalHours: `${Math.round(totals.consumedHours)}h`,
              },
              generatedBy: session?.name || undefined,
            });
          }}
        />
      )}
    </motion.div>
  );
}
