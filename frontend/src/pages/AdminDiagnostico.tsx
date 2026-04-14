import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  Bug,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  FileQuestion,
  Hash,
  Info,
  Link2Off,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  User,
  Wrench,
} from "lucide-react";
import PageHeaderCard from "@/components/PageHeaderCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import {
  deleteIntegrityElapsed,
  deleteIntegrityTask,
  fetchIntegrityDashboard,
  type IntegrityElapsedItem,
  type IntegrityPayload,
  type IntegrityRun,
  type IntegrityTaskItem,
  upsertIntegrityElapsedControl,
  upsertIntegrityTaskControl,
} from "@/modules/diagnostics/api/adminDiagnosticsApi";

type ReviewStatus = "pending" | "reviewing" | "resolved" | "ignored";
type VisibilityMode = "diagnostic_only" | "show_in_operations";
type DialogState =
  | { type: "task"; item: IntegrityTaskItem }
  | { type: "elapsed"; item: IntegrityElapsedItem }
  | null;

const visibilityOptions: Array<{ value: VisibilityMode; label: string; helper: string }> = [
  {
    value: "diagnostic_only",
    label: "Manter somente na central",
    helper: "A atividade permanece isolada e não aparece nas telas operacionais.",
  },
  {
    value: "show_in_operations",
    label: "Liberar para operação",
    helper: "A atividade volta a aparecer nas telas normais, mesmo com pendências registradas.",
  },
];

const reviewOptions: Array<{ value: ReviewStatus; label: string }> = [
  { value: "pending", label: "Pendente" },
  { value: "reviewing", label: "Em revisão" },
  { value: "resolved", label: "Resolvido" },
  { value: "ignored", label: "Ignorado" },
];

/* ─── Formatação ─── */

function formatDateTime(value?: string | null) {
  if (!value) return "Sem registro";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sem registro";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(parsed);
}

function formatDate(value?: string | null) {
  if (!value) return "Sem data";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(parsed);
}

function formatDuration(durationMs?: number | null) {
  if (!durationMs || durationMs <= 0) return "Sem duração registrada";
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}min ${seconds}s`;
}

function formatMinutes(minutes?: number, seconds?: number) {
  const totalSeconds = Math.max(0, Number(seconds ?? 0) + Number(minutes ?? 0) * 60);
  if (!totalSeconds) return "0min";
  const totalMinutes = Math.round(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}min`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}h ${mins}min`;
}

function summarizeCron(cron: string) {
  if (cron === "*/10 * * * *") return "a cada 10 minutos";
  if (cron === "*/30 * * * *") return "a cada 30 minutos";
  if (cron === "0 */4 * * *") return "a cada 4 horas";
  if (cron === "0 */6 * * *") return "a cada 6 horas";
  return "agendamento personalizado";
}

function formatTaskStatus(value: string | number | null | undefined) {
  if (typeof value === "number") {
    if (value === 1) return "Nova";
    if (value === 2) return "Aguardando execução (tarefa não iniciada)";
    if (value === 3) return "Em andamento";
    if (value === 4) return "Aguardando controle";
    if (value === 5) return "Concluída";
    if (value === 6) return "Adiada";
    if (value === 7) return "Recusada";
    return `Status ${value}`;
  }
  const normalized = String(value ?? "").trim();
  if (!normalized) return "Sem status";
  const lowered = normalized.toLowerCase();
  if (["1", "new", "nova"].includes(lowered)) return "Nova";
  if (["2", "pending", "waiting_for_execution", "aguardando execucao", "aguardando execução"].includes(lowered)) return "Aguardando execução (tarefa não iniciada)";
  if (["3", "in_progress", "em andamento"].includes(lowered)) return "Em andamento";
  if (["4", "awaiting_control", "supposedly_completed", "aguardando controle"].includes(lowered)) return "Aguardando controle";
  if (["5", "done", "concluido", "concluído", "completed", "finalizado"].includes(lowered)) return "Concluída";
  if (["6", "deferred", "postponed", "adiada"].includes(lowered)) return "Adiada";
  if (["7", "declined", "recusada"].includes(lowered)) return "Recusada";
  return normalized;
}

function dedupeTasks(items: IntegrityTaskItem[]) {
  const unique = new Map<number, IntegrityTaskItem>();
  for (const item of items) {
    if (!unique.has(item.task_id)) { unique.set(item.task_id, item); continue; }
    const existing = unique.get(item.task_id);
    if (!existing) continue;
    unique.set(item.task_id, existing.severity >= item.severity ? existing : item);
  }
  return Array.from(unique.values());
}

function matchesTaskSearch(item: IntegrityTaskItem, query: string) {
  if (!query) return true;
  const n = query.trim().toLowerCase();
  return item.title.toLowerCase().includes(n) || String(item.task_id).includes(n) || String(item.status ?? "").toLowerCase().includes(n) || String(item.responsible_name ?? "").toLowerCase().includes(n);
}

function matchesElapsedSearch(item: IntegrityElapsedItem, query: string) {
  if (!query) return true;
  const n = query.trim().toLowerCase();
  return String(item.bitrix_task_id_raw ?? item.task_id ?? "").includes(n) || String(item.id).includes(n) || String(item.related_task_name ?? "").toLowerCase().includes(n) || String(item.related_task_responsible ?? "").toLowerCase().includes(n);
}

function getReasonSummary(item: IntegrityTaskItem): string {
  if (!item.problems.length) return "Tarefa sinalizada para revisão.";
  const codes = item.problems.map((p) => p.code);
  const parts: string[] = [];
  if (codes.includes("missing_from_source")) parts.push("não encontrada na última verificação — pode ter sido excluída, arquivada ou estar inacessível");
  if (codes.includes("missing_project")) parts.push("sem projeto válido associado");
  if (codes.includes("missing_responsible")) parts.push("sem responsável definido");
  if (codes.includes("missing_deadline")) parts.push("sem prazo de entrega");
  if (codes.includes("missing_title")) parts.push("sem título");
  if (codes.includes("archived_task")) parts.push("tarefa arquivada na origem");
  if (!parts.length) return item.problems.map((p) => p.meaning).join(". ");
  return parts.length === 1
    ? `Tarefa ${parts[0]}.`
    : `Tarefa ${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}.`;
}

/** Find the real latest run for a given job_name from recent_runs */
function findLatestRunForJob(recentRuns: IntegrityRun[], jobName: string): IntegrityRun | null {
  const matching = recentRuns.filter((r) => r.job_name === jobName);
  if (!matching.length) return null;
  matching.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
  return matching[0];
}

/* ─── Componentes auxiliares ─── */

const CARD = "rounded-2xl border border-white/[0.08] bg-[hsl(228_25%_10%/0.9)] shadow-[0_2px_24px_hsl(222_45%_4%/0.25)]";
const INNER = "rounded-xl border border-white/[0.06] bg-white/[0.025]";

function StatCard({ label, value, helper, icon: Icon }: { label: string; value: string | number; helper: string; icon: typeof ShieldAlert }) {
  return (
    <div className={`${CARD} p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">{label}</p>
          <p className="mt-2.5 text-3xl font-bold tracking-tight text-white">{value}</p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-2.5 text-amber-300/80">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3.5 text-[13px] leading-[1.65] text-white/50">{helper}</p>
    </div>
  );
}

function EmptyPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center">
      <FileQuestion className="mx-auto h-8 w-8 text-white/20" />
      <p className="mt-3 text-base font-semibold text-white/80">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-white/45">{description}</p>
    </div>
  );
}

function MetaField({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Hash }) {
  return (
    <div className="flex items-start gap-2.5 min-w-0">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/30" />
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-white/35">{label}</p>
        <p className="mt-0.5 truncate text-sm text-white/80">{value}</p>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }: { icon: typeof Bug; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.04] p-2 text-sky-300/70">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h2 className="text-[15px] font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-[13px] text-white/45">{subtitle}</p>}
      </div>
    </div>
  );
}

function PaginationBar({ page, totalPages, onPrev, onNext, label }: { page: number; totalPages: number; onPrev: () => void; onNext: () => void; label?: string }) {
  if (totalPages <= 1) return null;
  return (
    <div className={`flex items-center justify-between ${CARD} px-5 py-3`}>
      <p className="text-sm text-white/50">{label ?? `Página ${page} de ${totalPages}`}</p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" disabled={page <= 1} onClick={onPrev} className="border-white/10 bg-white/5 text-white hover:bg-white/10">
          Anterior
        </Button>
        <Button type="button" variant="outline" disabled={page >= totalPages} onClick={onNext} className="border-white/10 bg-white/5 text-white hover:bg-white/10">
          Próxima
        </Button>
      </div>
    </div>
  );
}

function Pill({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-5 ${className}`}>
      {children}
    </span>
  );
}

/* ─── Página principal ─── */

export default function AdminDiagnostico() {
  const { session, loadingSession } = useAuth();
  const isManager = session?.role === "admin" || session?.role === "gerente" || session?.role === "coordenador";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<IntegrityPayload | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [visibilityMode, setVisibilityMode] = useState<VisibilityMode>("diagnostic_only");
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>("pending");
  const [adminNote, setAdminNote] = useState("");
  const [taskSearch, setTaskSearch] = useState("");
  const [elapsedSearch, setElapsedSearch] = useState("");
  const [taskPage, setTaskPage] = useState(1);
  const [elapsedPage, setElapsedPage] = useState(1);

  const loadDashboard = async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchIntegrityDashboard(session.accessToken);
      setPayload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar a central.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (session?.accessToken && isManager) void loadDashboard(); }, [session?.accessToken, isManager]);
  useEffect(() => { if (!dialogState) return; setVisibilityMode(dialogState.item.visibility_mode); setReviewStatus(dialogState.item.review_status); setAdminNote(dialogState.item.admin_note ?? ""); }, [dialogState]);

  const hiddenTaskCount = payload?.problematic_tasks.filter((t) => t.visibility_mode !== "show_in_operations").length ?? 0;
  const releasedTaskCount = payload?.problematic_tasks.filter((t) => t.visibility_mode === "show_in_operations").length ?? 0;

  const taskInsights = useMemo(() => {
    const items = dedupeTasks(payload?.problematic_tasks ?? []);
    return {
      withoutProject: items.filter((i) => i.problems.some((p) => p.code === "missing_project")).length,
      withoutOwner: items.filter((i) => i.problems.some((p) => p.code === "missing_responsible")).length,
      withoutDeadline: items.filter((i) => i.problems.some((p) => p.code === "missing_deadline")).length,
      archived: items.filter((i) => i.problems.some((p) => p.code === "archived_task")).length,
    };
  }, [payload]);

  const filteredTasks = useMemo(() => dedupeTasks(payload?.problematic_tasks ?? []).filter((i) => matchesTaskSearch(i, taskSearch)), [payload, taskSearch]);
  const filteredElapsed = useMemo(() => (payload?.orphan_elapsed ?? []).filter((i) => matchesElapsedSearch(i, elapsedSearch)), [payload, elapsedSearch]);

  const PAGE_SIZE = 8;
  const taskTotalPages = Math.max(1, Math.ceil(filteredTasks.length / PAGE_SIZE));
  const elapsedTotalPages = Math.max(1, Math.ceil(filteredElapsed.length / PAGE_SIZE));
  const pagedTasks = filteredTasks.slice((taskPage - 1) * PAGE_SIZE, taskPage * PAGE_SIZE);
  const pagedElapsed = filteredElapsed.slice((elapsedPage - 1) * PAGE_SIZE, elapsedPage * PAGE_SIZE);

  useEffect(() => { setTaskPage(1); }, [taskSearch, payload?.problematic_tasks.length]);
  useEffect(() => { setElapsedPage(1); }, [elapsedSearch, payload?.orphan_elapsed.length]);
  useEffect(() => { if (taskPage > taskTotalPages) setTaskPage(taskTotalPages); }, [taskPage, taskTotalPages]);
  useEffect(() => { if (elapsedPage > elapsedTotalPages) setElapsedPage(elapsedTotalPages); }, [elapsedPage, elapsedTotalPages]);

  const submitReview = async () => {
    if (!dialogState || !session?.accessToken) return;
    setSaving(true);
    setError(null);
    try {
      const nextPayload = dialogState.type === "task"
        ? await upsertIntegrityTaskControl(session.accessToken, { task_id: dialogState.item.task_id, visibility_mode: visibilityMode, review_status: reviewStatus, admin_note: adminNote || null })
        : await upsertIntegrityElapsedControl(session.accessToken, { elapsed_id: dialogState.item.id, visibility_mode: visibilityMode, review_status: reviewStatus, admin_note: adminNote || null });
      setPayload(nextPayload);
      setDialogState(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar a revisão.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!dialogState || !session?.accessToken) return;
    setSaving(true);
    setError(null);
    try {
      const nextPayload = dialogState.type === "task"
        ? await deleteIntegrityTask(session.accessToken, dialogState.item.task_id)
        : await deleteIntegrityElapsed(session.accessToken, dialogState.item.id);
      setPayload(nextPayload);
      setDialogState(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao excluir o registro.");
    } finally {
      setSaving(false);
    }
  };

  if (loadingSession) return null;
  if (!isManager) return <Navigate to="/" replace />;

  return (
    <div className="page-gradient w-full">
      <div className="mx-auto w-full max-w-[1900px] space-y-6 px-4 py-10 sm:px-5 md:px-8">
        <PageHeaderCard
          icon={ShieldAlert}
          title="Central de Integridade"
          subtitle="Painel administrativo para monitorar sincronizações, revisar tarefas problemáticas e decidir o que volta ou não para a operação."
          actions={
            <Button type="button" variant="outline" onClick={() => void loadDashboard()} disabled={loading} className="border-white/10 bg-white/5 text-white hover:bg-white/10">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Atualizando…" : "Atualizar painel"}
            </Button>
          }
        />

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1.5 rounded-xl border border-white/[0.08] bg-[hsl(230_25%_10%/0.85)] p-1.5">
            <TabsTrigger value="overview" className="rounded-lg px-4 py-2 text-[13px] data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-sm">
              Visão geral
            </TabsTrigger>
            <TabsTrigger value="tasks" className="rounded-lg px-4 py-2 text-[13px] data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-sm">
              Tarefas para revisão
            </TabsTrigger>
            <TabsTrigger value="elapsed" className="rounded-lg px-4 py-2 text-[13px] data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-sm">
              Horas sem vínculo
            </TabsTrigger>
            <TabsTrigger value="sync" className="rounded-lg px-4 py-2 text-[13px] data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-sm">
              Monitoramento
            </TabsTrigger>
          </TabsList>

          {/* ═══════ VISÃO GERAL ═══════ */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Última sincronização"
                value={formatDateTime(payload?.sync.latest_tasks_run?.started_at)}
                helper="Data e horário da rotina mais recente que trouxe tarefas e projetos para a base local."
                icon={CalendarClock}
              />
              <StatCard
                label="Tarefas resguardadas"
                value={hiddenTaskCount}
                helper="Atividades com dados incompletos, mantidas isoladas nesta central para não impactar a operação."
                icon={EyeOff}
              />
              <StatCard
                label="Horas sem tarefa"
                value={payload?.overview.orphan_elapsed_entries ?? 0}
                helper="Lançamentos de horas que não possuem uma tarefa válida associada na base local."
                icon={Link2Off}
              />
              <StatCard
                label="Liberadas para operação"
                value={releasedTaskCount}
                helper="Casos revisados e autorizados a voltar para as telas operacionais."
                icon={BadgeCheck}
              />
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
              <div className={`${CARD} p-6`}>
                <SectionHeader icon={Bug} title="O que a central está acompanhando" />
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {[
                    { title: "Sem projeto válido", count: taskInsights.withoutProject, desc: "Atividades sem vínculo a um projeto. Perdem contexto e não devem impactar painéis de produção." },
                    { title: "Sem responsável", count: taskInsights.withoutOwner, desc: "Tarefas que chegaram sem um responsável definido. Precisam de revisão antes de voltar ao fluxo." },
                    { title: "Sem prazo", count: taskInsights.withoutDeadline, desc: "Atividades sem data de entrega. Isso compromete a leitura de atraso, prioridade e agenda." },
                    { title: "Tarefas arquivadas", count: taskInsights.archived, desc: "Tarefas que ainda existem na base, mas estão arquivadas e precisam de revisão manual." },
                  ].map((item) => (
                    <div key={item.title} className={`${INNER} p-4`}>
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="mt-2 text-2xl font-bold tracking-tight text-white">{item.count}</p>
                      <p className="mt-2 text-[13px] leading-[1.6] text-white/50">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`${CARD} p-6`}>
                <SectionHeader icon={Wrench} title="Guia rápido de decisão" />
                <div className="mt-5 space-y-3">
                  {[
                    { title: "Manter somente na central", desc: "Use quando a atividade ainda precisa de correção ou quando o histórico deve ser preservado sem poluir gestão, analíticas e calendário." },
                    { title: "Liberar para operação", desc: "Use quando o caso foi revisado e faz sentido reaparecer nas telas normais, mesmo com alguma observação." },
                    { title: "Excluir da base local", desc: "Use para remover registros que não fazem mais sentido. A exclusão remove o item apenas desta base local." },
                  ].map((item) => (
                    <div key={item.title} className={`${INNER} p-4`}>
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="mt-1.5 text-[13px] leading-[1.6] text-white/50">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ═══════ TAREFAS PARA REVISÃO ═══════ */}
          <TabsContent value="tasks" className="space-y-5">
            {/* Header + busca */}
            <div className={`${CARD} p-5`}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[15px] font-semibold text-white">Tarefas para revisão</p>
                  <p className="mt-1 text-[13px] text-white/50">
                    Itens que existem na base local mas precisam de validação antes de voltar ao fluxo operacional.
                  </p>
                </div>
                <div className="flex w-full flex-col gap-2 lg:w-auto lg:min-w-[360px]">
                  <input
                    type="search"
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    placeholder="Buscar por nome, responsável ou ID…"
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/20"
                  />
                  <p className="text-[11px] text-white/40">
                    Exibindo {pagedTasks.length} de {filteredTasks.length} tarefa(s)
                  </p>
                </div>
              </div>
            </div>

            {/* Global explanation block */}
            {filteredTasks.length > 0 && (
              <div className={`${CARD} flex items-start gap-3 px-5 py-4`}>
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-300/60" />
                <div className="space-y-1.5 text-[13px] leading-[1.6] text-white/55">
                  <p className="font-semibold text-white/70">Por que estas tarefas estão aqui?</p>
                  <div className="flex flex-col gap-1">
                    <p><span className="font-medium text-white/65">Não encontrada ou sem acesso</span> — a tarefa pode ter sido excluída, arquivada, filtrada ou estar sem permissão de acesso na origem.</p>
                    <p><span className="font-medium text-white/65">Dados incompletos</span> — a tarefa chegou sem projeto, sem responsável ou sem prazo de entrega.</p>
                    <p><span className="font-medium text-white/65">Sincronização</span> — falhas temporárias podem ter impedido a atualização. Revise antes de tomar qualquer decisão.</p>
                  </div>
                </div>
              </div>
            )}

            {!filteredTasks.length ? (
              <EmptyPanel
                title="Nenhuma tarefa pendente de revisão"
                description="Quando houver tarefas com dados incompletos (sem projeto, sem responsável, sem prazo ou arquivadas), elas aparecerão aqui para revisão."
              />
            ) : (
              <>
                {pagedTasks.map((task) => (
                  <div key={task.task_id} className={`${CARD} p-5`}>
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:gap-6">
                      {/* Main content */}
                      <div className="min-w-0 flex-1 space-y-4">
                        {/* Title */}
                        <h3 className="text-base font-semibold leading-snug text-white">{task.title}</h3>

                        {/* Metadata grid */}
                        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                          <MetaField icon={Hash} label="ID da tarefa" value={`#${task.task_id}`} />
                          <MetaField icon={User} label="Responsável" value={task.responsible_name ?? "Não encontrado"} />
                          <MetaField icon={CheckCircle2} label="Status" value={formatTaskStatus(task.status)} />
                          <MetaField icon={Bug} label="Projeto" value={task.project_name ?? "Sem projeto válido"} />
                          <MetaField icon={CalendarClock} label="Prazo" value={formatDate(task.deadline)} />
                          <MetaField icon={Clock3} label="Última atualização" value={formatDateTime(task.updated_at)} />
                        </div>

                        {/* Concise reason */}
                        <p className="text-[13px] leading-[1.6] text-amber-200/60">
                          {getReasonSummary(task)}
                        </p>

                        {/* Admin note */}
                        {task.admin_note && (
                          <div className="rounded-lg border border-sky-500/20 bg-sky-500/[0.06] px-3.5 py-2.5 text-[13px] leading-relaxed text-sky-100">
                            <strong className="font-semibold">Nota:</strong> {task.admin_note}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex shrink-0 flex-row gap-2 xl:w-[200px] xl:flex-col">
                        <Button
                          type="button"
                          className="justify-start gap-2 border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.12]"
                          variant="outline"
                          onClick={() => setDialogState({ type: "task", item: task })}
                        >
                          <ShieldAlert className="h-4 w-4 text-amber-300/80" />
                          Revisar caso
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="justify-start gap-2 border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.12]"
                          onClick={() =>
                            setDialogState({
                              type: "task",
                              item: { ...task, visibility_mode: task.visibility_mode === "show_in_operations" ? "diagnostic_only" : "show_in_operations" },
                            })
                          }
                        >
                          <ArrowUpRight className="h-4 w-4 text-sky-300/80" />
                          {task.visibility_mode === "show_in_operations" ? "Resguardar na central" : "Liberar para operação"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                <PaginationBar
                  page={taskPage}
                  totalPages={taskTotalPages}
                  onPrev={() => setTaskPage((c) => Math.max(1, c - 1))}
                  onNext={() => setTaskPage((c) => Math.min(taskTotalPages, c + 1))}
                  label={`Página ${taskPage} de ${taskTotalPages}`}
                />
              </>
            )}
          </TabsContent>

          {/* ═══════ HORAS SEM VÍNCULO ═══════ */}
          <TabsContent value="elapsed" className="space-y-5">
            <div className={`${CARD} p-5`}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[15px] font-semibold text-white">Horas sem vínculo</p>
                  <p className="mt-1 text-[13px] text-white/50">
                    Lançamentos de horas que não possuem uma tarefa válida associada e precisam de revisão.
                  </p>
                </div>
                <div className="flex w-full flex-col gap-2 lg:w-auto lg:min-w-[360px]">
                  <input
                    type="search"
                    value={elapsedSearch}
                    onChange={(e) => setElapsedSearch(e.target.value)}
                    placeholder="Buscar por tarefa, responsável ou ID…"
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/20"
                  />
                  <p className="text-[11px] text-white/40">
                    Exibindo {pagedElapsed.length} de {filteredElapsed.length} lançamento(s)
                  </p>
                </div>
              </div>
            </div>

            {/* Global explanation */}
            {filteredElapsed.length > 0 && (
              <div className={`${CARD} flex items-start gap-3 px-5 py-4`}>
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-300/60" />
                <p className="text-[13px] leading-[1.6] text-white/55">
                  <span className="font-semibold text-white/70">Por que estes lançamentos estão aqui?</span>{" "}
                  Cada lançamento referencia uma tarefa que não foi encontrada na última verificação. A tarefa pode ter sido excluída, arquivada ou estar inacessível por questões de permissão, filtro ou sincronização.
                </p>
              </div>
            )}

            {!filteredElapsed.length ? (
              <EmptyPanel
                title="Nenhum lançamento sem vínculo"
                description="Quando um lançamento de horas não possuir uma tarefa válida associada na base local, ele aparecerá aqui para revisão."
              />
            ) : (
              <>
                {pagedElapsed.map((entry) => (
                  <div key={entry.id} className={`${CARD} p-5`}>
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:gap-6">
                      <div className="min-w-0 flex-1 space-y-4">
                        <h3 className="text-base font-semibold leading-snug text-white">{entry.label}</h3>

                        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                          <MetaField icon={Hash} label="ID do lançamento" value={`#${entry.id}`} />
                          <MetaField icon={Hash} label="ID da tarefa" value={entry.bitrix_task_id_raw != null ? `#${entry.bitrix_task_id_raw}` : (entry.task_id != null ? `#${entry.task_id}` : "Sem ID")} />
                          <MetaField icon={User} label="Responsável da tarefa" value={entry.related_task_responsible ?? "Não encontrado"} />
                          <MetaField icon={CheckCircle2} label="Status da tarefa" value={formatTaskStatus(entry.related_task_status)} />
                          <MetaField icon={Bug} label="Projeto vinculado" value={entry.related_task_name ?? "Não localizado"} />
                          <MetaField icon={Clock3} label="Duração" value={formatMinutes(entry.minutes, entry.seconds)} />
                          <MetaField icon={CalendarClock} label="Detectado em" value={formatDateTime(entry.orphan_detected_at)} />
                          <MetaField icon={Clock3} label="Última atualização" value={formatDateTime(entry.updated_at)} />
                        </div>

                        {/* Comment */}
                        {entry.comment_text && (
                          <p className="text-[13px] leading-relaxed text-white/50">
                            <strong className="font-semibold text-white/70">Comentário:</strong> {entry.comment_text}
                          </p>
                        )}

                        {/* Admin note */}
                        {entry.admin_note && (
                          <div className="rounded-lg border border-sky-500/20 bg-sky-500/[0.06] px-3.5 py-2.5 text-[13px] leading-relaxed text-sky-100">
                            <strong className="font-semibold">Nota:</strong> {entry.admin_note}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex shrink-0 flex-row gap-2 xl:w-[200px] xl:flex-col">
                        <Button
                          type="button"
                          variant="outline"
                          className="justify-start gap-2 border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.12]"
                          onClick={() => setDialogState({ type: "elapsed", item: entry })}
                        >
                          <ShieldAlert className="h-4 w-4 text-amber-300/80" />
                          Revisar lançamento
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                <PaginationBar
                  page={elapsedPage}
                  totalPages={elapsedTotalPages}
                  onPrev={() => setElapsedPage((c) => Math.max(1, c - 1))}
                  onNext={() => setElapsedPage((c) => Math.min(elapsedTotalPages, c + 1))}
                  label={`Página ${elapsedPage} de ${elapsedTotalPages}`}
                />
              </>
            )}
          </TabsContent>

          {/* ═══════ MONITORAMENTO ═══════ */}
          <TabsContent value="sync" className="space-y-5">
            <div className="grid gap-5 xl:grid-cols-2">
              {/* Últimas execuções */}
              <div className={`${CARD} p-6`}>
                <SectionHeader icon={Clock3} title="Últimas execuções" subtitle="Resultado das rotinas de sincronização mais recentes" />
                <div className="mt-5 space-y-3">
                  {[
                    { label: "Rotina de tarefas e projetos", run: payload?.sync.latest_tasks_run },
                    { label: "Rotina de tempos lançados", run: payload?.sync.latest_times_run },
                  ].map((item) => (
                    <div key={item.label} className={`${INNER} p-4`}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white">{item.label}</p>
                        {item.run && (
                          <Pill className={item.run.status === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-red-500/30 bg-red-500/10 text-red-200"}>
                            {item.run.status === "success" ? "Sucesso" : item.run.status ?? "sem registro"}
                          </Pill>
                        )}
                      </div>
                      <p className="mt-2 text-[13px] leading-[1.6] text-white/55">
                        Executada em {formatDateTime(item.run?.started_at)}
                        {item.run?.finished_at && <> · Concluída em {formatDateTime(item.run.finished_at)}</>}
                      </p>
                      <p className="mt-1 text-[11px] text-white/40">
                        Duração: {formatDuration(item.run?.duration_ms)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Agendamentos ativos — show real latest run from recent_runs */}
              <div className={`${CARD} p-6`}>
                <SectionHeader icon={CalendarClock} title="Agendamentos ativos" subtitle="Rotinas de sincronização programadas" />
                <div className="mt-5 space-y-3">
                  {(payload?.sync.configs ?? []).map((config) => {
                    const realLatest = findLatestRunForJob(payload?.sync.recent_runs ?? [], config.job_name);
                    return (
                      <div key={config.job_name} className={`${INNER} p-4`}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white">{config.job_name}</p>
                            <p className="mt-1 text-[11px] text-white/40">
                              Cron: {config.cron_expression} · {summarizeCron(config.cron_expression)}
                            </p>
                          </div>
                          <Pill className={config.enabled ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-white/10 bg-white/[0.03] text-white/50"}>
                            {config.enabled ? "Ativo" : "Desativado"}
                          </Pill>
                        </div>
                        <p className="mt-3 text-[13px] leading-[1.6] text-white/50">
                          Última execução real: {formatDateTime(realLatest?.started_at ?? config.last_scheduled_at)}
                          {realLatest && (
                            <> · <span className={realLatest.status === "success" ? "text-emerald-300/70" : "text-red-300/70"}>{realLatest.status === "success" ? "Sucesso" : realLatest.status}</span></>
                          )}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Histórico recente */}
            <div className={`${CARD} p-6`}>
              <SectionHeader icon={AlertTriangle} title="Histórico recente" subtitle="Execuções registradas nas últimas horas" />
              {!(payload?.sync.recent_runs ?? []).length ? (
                <p className="mt-5 text-[13px] text-white/40">Nenhuma execução recente registrada.</p>
              ) : (
                <div className="mt-5 space-y-3">
                  {(payload?.sync.recent_runs ?? []).map((run, index) => (
                    <div key={`${run.job_name}-${run.started_at}-${index}`} className={`${INNER} p-4`}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white">{run.job_name}</p>
                          <p className="mt-1 text-[11px] text-white/40">
                            Iniciou em {formatDateTime(run.started_at)}
                            {run.finished_at && <> · Concluiu em {formatDateTime(run.finished_at)}</>}
                            {" · Duração: "}{formatDuration(run.duration_ms)}
                          </p>
                        </div>
                        <Pill className={run.status === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-red-500/30 bg-red-500/10 text-red-200"}>
                          {run.status === "success" ? "Sucesso" : run.status}
                        </Pill>
                      </div>
                      {run.error_message && (
                        <p className="mt-2.5 text-sm leading-relaxed text-red-200/80">{run.error_message}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ═══════ DIALOG DE REVISÃO ═══════ */}
      <Dialog open={Boolean(dialogState)} onOpenChange={(open) => !open && setDialogState(null)}>
        <DialogContent className="border-white/10 bg-[hsl(230_28%_11%)] text-white sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {dialogState?.type === "task" ? "Revisar tarefa" : "Revisar lançamento"}
            </DialogTitle>
            <DialogDescription className="text-white/50">
              Defina se este caso permanece isolado na central, se pode voltar para a operação ou se deve ser removido.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className={`${INNER} p-4`}>
              <p className="text-sm font-semibold text-white">
                {dialogState?.type === "task"
                  ? dialogState.item.title
                  : `${dialogState?.item.label ?? "Lançamento sem vínculo"} #${dialogState?.type === "elapsed" ? dialogState.item.id : ""}`}
              </p>
              <p className="mt-2 text-[13px] leading-[1.6] text-white/50">
                {dialogState?.type === "task"
                  ? getReasonSummary(dialogState.item)
                  : dialogState?.item.meaning || "Lançamento referencia uma tarefa não encontrada na última verificação."}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white" htmlFor="visibility-mode">Destino do caso</label>
              <select
                id="visibility-mode"
                value={visibilityMode}
                onChange={(e) => setVisibilityMode(e.target.value as VisibilityMode)}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white outline-none"
              >
                {visibilityOptions.map((o) => (
                  <option key={o.value} value={o.value} className="bg-slate-900 text-white">{o.label}</option>
                ))}
              </select>
              <p className="text-[12px] leading-5 text-white/40">{visibilityOptions.find((o) => o.value === visibilityMode)?.helper}</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white" htmlFor="review-status">Etapa da revisão</label>
              <select
                id="review-status"
                value={reviewStatus}
                onChange={(e) => setReviewStatus(e.target.value as ReviewStatus)}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white outline-none"
              >
                {reviewOptions.map((o) => (
                  <option key={o.value} value={o.value} className="bg-slate-900 text-white">{o.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white" htmlFor="admin-note">Observação administrativa</label>
              <textarea
                id="admin-note"
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={3}
                placeholder="Ex.: atividade arquivada na origem, manter apenas para histórico."
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-3 text-sm text-white outline-none placeholder:text-white/25"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="destructive" onClick={() => void handleDelete()} disabled={saving} className="sm:mr-auto">
              <Trash2 className="h-4 w-4" />
              Excluir da base local
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => setDialogState(null)} disabled={saving} className="border-white/10 bg-white/5 text-white hover:bg-white/10">
                Cancelar
              </Button>
              <Button type="button" onClick={() => void submitReview()} disabled={saving}>
                {saving ? "Salvando…" : "Salvar revisão"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
