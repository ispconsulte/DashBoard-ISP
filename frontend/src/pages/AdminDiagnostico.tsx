import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  Bug,
  CalendarClock,
  Clock3,
  EyeOff,
  Link2Off,
  RefreshCw,
  ShieldAlert,
  Trash2,
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
  type IntegrityProblem,
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
    label: "Manter so na central",
    helper: "A atividade continua isolada e nao entra nas telas operacionais.",
  },
  {
    value: "show_in_operations",
    label: "Liberar para operacao",
    helper: "A atividade volta a aparecer nas telas normais mesmo com pendencias.",
  },
];

const reviewOptions: Array<{ value: ReviewStatus; label: string }> = [
  { value: "pending", label: "Pendente" },
  { value: "reviewing", label: "Em revisao" },
  { value: "resolved", label: "Resolvido" },
  { value: "ignored", label: "Ignorado" },
];

function formatDateTime(value?: string | null) {
  if (!value) return "Sem registro";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sem registro";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed);
}

function formatDate(value?: string | null) {
  if (!value) return "Sem data";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(parsed);
}

function formatDuration(durationMs?: number | null) {
  if (!durationMs || durationMs <= 0) return "Sem duracao registrada";
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

function getStatusLabel(value: ReviewStatus) {
  return reviewOptions.find((option) => option.value === value)?.label ?? value;
}

function getVisibilityLabel(value: VisibilityMode) {
  return visibilityOptions.find((option) => option.value === value)?.label ?? value;
}

function formatTaskStatus(value: string | number | null | undefined) {
  if (typeof value === "number") {
    if (value === 5) return "Concluida";
    return `Status ${value}`;
  }

  const normalized = String(value ?? "").trim();
  if (!normalized) return "Sem status";
  if (["5", "done", "concluido", "concluído", "completed", "finalizado"].includes(normalized.toLowerCase())) {
    return "Concluida";
  }
  return normalized;
}

function getSeverityTone(severity: number) {
  if (severity >= 90) return "border-red-500/30 bg-red-500/10 text-red-200";
  if (severity >= 70) return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  return "border-sky-500/30 bg-sky-500/10 text-sky-100";
}

function dedupeTasks(items: IntegrityTaskItem[]) {
  const unique = new Map<number, IntegrityTaskItem>();
  for (const item of items) {
    if (!unique.has(item.task_id)) {
      unique.set(item.task_id, item);
      continue;
    }

    const existing = unique.get(item.task_id);
    if (!existing) continue;
    unique.set(item.task_id, existing.severity >= item.severity ? existing : item);
  }
  return Array.from(unique.values());
}

function matchesTaskSearch(item: IntegrityTaskItem, query: string) {
  if (!query) return true;
  const normalized = query.trim().toLowerCase();
  return (
    item.title.toLowerCase().includes(normalized) ||
    String(item.task_id).includes(normalized) ||
    String(item.status ?? "").toLowerCase().includes(normalized) ||
    String(item.responsible_name ?? "").toLowerCase().includes(normalized)
  );
}

function matchesElapsedSearch(item: IntegrityElapsedItem, query: string) {
  if (!query) return true;
  const normalized = query.trim().toLowerCase();
  return (
    String(item.bitrix_task_id_raw ?? item.task_id ?? "").includes(normalized) ||
    String(item.id).includes(normalized) ||
    String(item.related_task_name ?? "").toLowerCase().includes(normalized) ||
    String(item.related_task_responsible ?? "").toLowerCase().includes(normalized)
  );
}

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  helper: string;
  icon: typeof ShieldAlert;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[hsl(228_25%_10%/0.9)] p-4 shadow-[0_18px_40px_hsl(222_45%_4%/0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-white/40">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-amber-200">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-white/55">{helper}</p>
    </div>
  );
}

function Pill({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

function TaskProblemPills({ problems }: { problems: IntegrityProblem[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {problems.map((problem) => (
        <Pill key={problem.code} className={getSeverityTone(problem.severity)}>
          {problem.label}
        </Pill>
      ))}
    </div>
  );
}

function EmptyPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-6 py-10 text-center">
      <p className="text-base font-semibold text-white">{title}</p>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-white/55">{description}</p>
    </div>
  );
}

export default function AdminDiagnostico() {
  const { session, loadingSession } = useAuth();
  const isManager =
    session?.role === "admin" ||
    session?.role === "gerente" ||
    session?.role === "coordenador";

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
      const message = err instanceof Error ? err.message : "Falha ao carregar a central.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.accessToken && isManager) {
      void loadDashboard();
    }
  }, [session?.accessToken, isManager]);

  useEffect(() => {
    if (!dialogState) return;
    setVisibilityMode(dialogState.item.visibility_mode);
    setReviewStatus(dialogState.item.review_status);
    setAdminNote(dialogState.item.admin_note ?? "");
  }, [dialogState]);

  const hiddenTaskCount = payload?.problematic_tasks.filter((task) => task.visibility_mode !== "show_in_operations").length ?? 0;
  const releasedTaskCount = payload?.problematic_tasks.filter((task) => task.visibility_mode === "show_in_operations").length ?? 0;

  const taskInsights = useMemo(() => {
    const items = dedupeTasks(payload?.problematic_tasks ?? []);
    return {
      withoutProject: items.filter((item) => item.problems.some((problem) => problem.code === "missing_project")).length,
      withoutOwner: items.filter((item) => item.problems.some((problem) => problem.code === "missing_responsible")).length,
      withoutDeadline: items.filter((item) => item.problems.some((problem) => problem.code === "missing_deadline")).length,
      archived: items.filter((item) => item.problems.some((problem) => problem.code === "archived_task")).length,
    };
  }, [payload]);

  const filteredTasks = useMemo(() => {
    return dedupeTasks(payload?.problematic_tasks ?? []).filter((item) => matchesTaskSearch(item, taskSearch));
  }, [payload, taskSearch]);

  const filteredElapsed = useMemo(() => {
    return (payload?.orphan_elapsed ?? []).filter((item) => matchesElapsedSearch(item, elapsedSearch));
  }, [payload, elapsedSearch]);

  const taskPageSize = 8;
  const elapsedPageSize = 8;
  const taskTotalPages = Math.max(1, Math.ceil(filteredTasks.length / taskPageSize));
  const elapsedTotalPages = Math.max(1, Math.ceil(filteredElapsed.length / elapsedPageSize));
  const pagedTasks = filteredTasks.slice((taskPage - 1) * taskPageSize, taskPage * taskPageSize);
  const pagedElapsed = filteredElapsed.slice((elapsedPage - 1) * elapsedPageSize, elapsedPage * elapsedPageSize);

  useEffect(() => {
    setTaskPage(1);
  }, [taskSearch, payload?.problematic_tasks.length]);

  useEffect(() => {
    setElapsedPage(1);
  }, [elapsedSearch, payload?.orphan_elapsed.length]);

  useEffect(() => {
    if (taskPage > taskTotalPages) setTaskPage(taskTotalPages);
  }, [taskPage, taskTotalPages]);

  useEffect(() => {
    if (elapsedPage > elapsedTotalPages) setElapsedPage(elapsedTotalPages);
  }, [elapsedPage, elapsedTotalPages]);

  const submitReview = async () => {
    if (!dialogState || !session?.accessToken) return;
    setSaving(true);
    setError(null);
    try {
      const nextPayload =
        dialogState.type === "task"
          ? await upsertIntegrityTaskControl(session.accessToken, {
              task_id: dialogState.item.task_id,
              visibility_mode: visibilityMode,
              review_status: reviewStatus,
              admin_note: adminNote || null,
            })
          : await upsertIntegrityElapsedControl(session.accessToken, {
              elapsed_id: dialogState.item.id,
              visibility_mode: visibilityMode,
              review_status: reviewStatus,
              admin_note: adminNote || null,
            });
      setPayload(nextPayload);
      setDialogState(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao salvar a revisao.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!dialogState || !session?.accessToken) return;
    setSaving(true);
    setError(null);
    try {
      const nextPayload =
        dialogState.type === "task"
          ? await deleteIntegrityTask(session.accessToken, dialogState.item.task_id)
          : await deleteIntegrityElapsed(session.accessToken, dialogState.item.id);
      setPayload(nextPayload);
      setDialogState(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao excluir o registro.";
      setError(message);
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
          subtitle="Painel administrativo para monitorar sincronizacoes, isolar tarefas problematicas e decidir o que volta ou nao para a operacao."
          actions={
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadDashboard()}
              disabled={loading}
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Atualizando" : "Atualizar painel"}
            </Button>
          }
        />

        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-2xl border border-white/10 bg-[hsl(230_25%_10%/0.85)] p-2">
            <TabsTrigger value="overview" className="rounded-xl px-4 py-2 data-[state=active]:bg-white data-[state=active]:text-slate-950">
              Visao geral
            </TabsTrigger>
            <TabsTrigger value="tasks" className="rounded-xl px-4 py-2 data-[state=active]:bg-white data-[state=active]:text-slate-950">
              Tarefas para revisao
            </TabsTrigger>
            <TabsTrigger value="elapsed" className="rounded-xl px-4 py-2 data-[state=active]:bg-white data-[state=active]:text-slate-950">
              Horas sem vinculo
            </TabsTrigger>
            <TabsTrigger value="sync" className="rounded-xl px-4 py-2 data-[state=active]:bg-white data-[state=active]:text-slate-950">
              Monitoramento
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Ultimo envio de tarefas"
                value={formatDateTime(payload?.sync.latest_tasks_run?.started_at)}
                helper="Mostra quando a rotina mais recente trouxe tarefas e projetos para a base local."
                icon={CalendarClock}
              />
              <StatCard
                label="Tarefas resguardadas"
                value={hiddenTaskCount}
                helper="Sao atividades com risco de dado incompleto. Elas ficam so nesta central e nao entram no dia a dia."
                icon={EyeOff}
              />
              <StatCard
                label="Horas sem tarefa"
                value={payload?.overview.orphan_elapsed_entries ?? 0}
                helper="Lancamentos de horas que ficaram sem atividade valida para relacionar."
                icon={Link2Off}
              />
              <StatCard
                label="Liberadas para operacao"
                value={releasedTaskCount}
                helper="Casos revisados manualmente e autorizados a voltar para as telas normais."
                icon={BadgeCheck}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
              <div className="rounded-2xl border border-white/10 bg-[hsl(228_25%_10%/0.9)] p-5">
                <div className="flex items-center gap-2 text-white">
                  <Bug className="h-4 w-4 text-amber-200" />
                  <h2 className="text-base font-semibold">O que a central esta acompanhando</h2>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-sm font-semibold text-white">Sem projeto valido</p>
                    <p className="mt-2 text-3xl font-semibold text-white">{taskInsights.withoutProject}</p>
                    <p className="mt-2 text-sm leading-6 text-white/55">
                      Atividades sem vinculo operacional. Elas perdem contexto e nao devem impactar paineis de producao.
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-sm font-semibold text-white">Sem responsavel</p>
                    <p className="mt-2 text-3xl font-semibold text-white">{taskInsights.withoutOwner}</p>
                    <p className="mt-2 text-sm leading-6 text-white/55">
                      Casos que chegaram sem dono definido. A ideia e revisar antes de recolocar no fluxo normal.
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-sm font-semibold text-white">Sem prazo</p>
                    <p className="mt-2 text-3xl font-semibold text-white">{taskInsights.withoutDeadline}</p>
                    <p className="mt-2 text-sm leading-6 text-white/55">
                      Atividades sem data de entrega. Isso compromete leitura de atraso, prioridade e agenda.
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-sm font-semibold text-white">Tarefas arquivadas</p>
                    <p className="mt-2 text-3xl font-semibold text-white">{taskInsights.archived}</p>
                    <p className="mt-2 text-sm leading-6 text-white/55">
                      Casos que continuam existindo, mas estao arquivados no contexto atual e por isso precisam de revisao manual antes de voltar para a operacao.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[hsl(228_25%_10%/0.9)] p-5">
                <div className="flex items-center gap-2 text-white">
                  <Wrench className="h-4 w-4 text-sky-200" />
                  <h2 className="text-base font-semibold">Guia rapido de decisao</h2>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-sm font-semibold text-white">Manter so na central</p>
                    <p className="mt-2 text-sm leading-6 text-white/55">
                      Use quando a atividade ainda precisa de correcao ou quando o historico precisa ficar guardado sem poluir gestao, analiticas e calendario.
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-sm font-semibold text-white">Liberar para operacao</p>
                    <p className="mt-2 text-sm leading-6 text-white/55">
                      Use quando o caso foi revisado e faz sentido reaparecer nas telas normais mesmo com alguma observacao administrativa.
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-sm font-semibold text-white">Excluir da base local</p>
                    <p className="mt-2 text-sm leading-6 text-white/55">
                      Use para limpar registros que realmente nao fazem mais sentido manter. A exclusao remove o item localmente desta base.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tasks" className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-[hsl(228_25%_10%/0.9)] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Tarefas para revisao</p>
                  <p className="mt-1 text-sm text-white/55">
                    Itens que ainda existem na base atual, mas precisam de validacao antes de voltar ao fluxo operacional.
                  </p>
                </div>
                <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[360px]">
                  <input
                    type="search"
                    value={taskSearch}
                    onChange={(event) => setTaskSearch(event.target.value)}
                    placeholder="Buscar por nome da tarefa ou ID"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25"
                  />
                  <p className="text-xs text-white/45">
                    Mostrando {pagedTasks.length} de {filteredTasks.length} tarefa(s).
                  </p>
                </div>
              </div>
            </div>

            {!filteredTasks.length ? (
              <EmptyPanel
                title="Nenhuma tarefa pendente de revisao"
                description="Quando houver tarefa ativa sem projeto valido, sem responsavel, sem prazo ou arquivada, ela aparece aqui para revisao."
              />
            ) : (
              <>
              {pagedTasks.map((task) => (
                <div key={task.task_id} className="rounded-2xl border border-white/10 bg-[hsl(228_25%_10%/0.9)] p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <p className="text-lg font-semibold text-white">{task.title}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-white/70">
                          <Pill className="border-white/10 bg-white/[0.03] text-white/70">Tarefa #{task.task_id}</Pill>
                          <Pill className="border-white/10 bg-white/[0.03] text-white/70">Responsavel: {task.responsible_name ?? "Nao encontrado"}</Pill>
                          <Pill className="border-white/10 bg-white/[0.03] text-white/70">Status: {formatTaskStatus(task.status)}</Pill>
                          <Pill className="border-white/10 bg-white/[0.03] text-white/70">Projeto: {task.project_name ?? "Sem projeto valido"}</Pill>
                        </div>
                      </div>
                      <TaskProblemPills problems={task.problems} />
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-sm font-semibold text-white">Motivos da revisao</p>
                        <div className="mt-3 space-y-3">
                        {task.problems.map((problem) => (
                          <div key={problem.code} className="rounded-xl border border-white/10 bg-[hsl(228_20%_12%/0.9)] p-3">
                            <p className="text-sm font-semibold text-white">{problem.label}</p>
                            <p className="mt-1 text-sm leading-6 text-white/55">{problem.meaning}</p>
                          </div>
                        ))}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-white/60">
                        <Pill className="border-white/10 bg-white/[0.03] text-white/70">
                          Prazo: {formatDate(task.deadline)}
                        </Pill>
                        <Pill className="border-white/10 bg-white/[0.03] text-white/70">
                          Ultima atualizacao: {formatDateTime(task.updated_at)}
                        </Pill>
                        <Pill className="border-white/10 bg-white/[0.03] text-white/70">
                          Exibicao: {getVisibilityLabel(task.visibility_mode)}
                        </Pill>
                        <Pill className="border-white/10 bg-white/[0.03] text-white/70">
                          Revisao: {getStatusLabel(task.review_status)}
                        </Pill>
                      </div>
                      {task.admin_note ? (
                        <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-4 text-sm leading-6 text-sky-100">
                          <strong className="font-semibold">Observacao administrativa:</strong> {task.admin_note}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col gap-2 xl:w-[220px]">
                      <Button
                        type="button"
                        variant="outline"
                        className="justify-start border-white/10 bg-white/5 text-white hover:bg-white/10"
                        onClick={() => setDialogState({ type: "task", item: task })}
                      >
                        <ShieldAlert className="h-4 w-4" />
                        Revisar caso
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="justify-start border-white/10 bg-white/5 text-white hover:bg-white/10"
                        onClick={() =>
                          setDialogState({
                            type: "task",
                            item: {
                              ...task,
                              visibility_mode:
                                task.visibility_mode === "show_in_operations"
                                  ? "diagnostic_only"
                                  : "show_in_operations",
                            },
                          })
                        }
                      >
                        <ArrowUpRight className="h-4 w-4" />
                        {task.visibility_mode === "show_in_operations" ? "Resguardar na central" : "Liberar para operacao"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {taskTotalPages > 1 ? (
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[hsl(228_25%_10%/0.9)] px-4 py-3">
                  <p className="text-sm text-white/55">
                    Pagina {taskPage} de {taskTotalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={taskPage <= 1}
                      onClick={() => setTaskPage((current) => Math.max(1, current - 1))}
                      className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                    >
                      Anterior
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={taskPage >= taskTotalPages}
                      onClick={() => setTaskPage((current) => Math.min(taskTotalPages, current + 1))}
                      className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                    >
                      Proxima
                    </Button>
                  </div>
                </div>
              ) : null}
              </>
            )}
          </TabsContent>

          <TabsContent value="elapsed" className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-[hsl(228_25%_10%/0.9)] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Horas sem vinculo</p>
                  <p className="mt-1 text-sm text-white/55">
                    Lancamentos que ainda existem, mas precisam de revisao porque o relacionamento com a tarefa nao ficou consistente.
                  </p>
                </div>
                <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[360px]">
                  <input
                    type="search"
                    value={elapsedSearch}
                    onChange={(event) => setElapsedSearch(event.target.value)}
                    placeholder="Buscar por tarefa, responsavel ou ID"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25"
                  />
                  <p className="text-xs text-white/45">
                    Mostrando {pagedElapsed.length} de {filteredElapsed.length} lancamento(s).
                  </p>
                </div>
              </div>
            </div>

            {!filteredElapsed.length ? (
              <EmptyPanel
                title="Nenhum lancamento sem vinculo"
                description="Quando uma hora registrada continuar sem relacionamento local valido, ela aparece aqui para revisao e limpeza."
              />
            ) : (
              <>
              {pagedElapsed.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-white/10 bg-[hsl(228_25%_10%/0.9)] p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-3">
                      <div>
                        <p className="text-lg font-semibold text-white">{entry.label}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/70">
                          <Pill className="border-white/10 bg-white/[0.03] text-white/70">Lancamento #{entry.id}</Pill>
                          <Pill className="border-white/10 bg-white/[0.03] text-white/70">Duracao: {formatMinutes(entry.minutes, entry.seconds)}</Pill>
                          <Pill className="border-white/10 bg-white/[0.03] text-white/70">
                            Tarefa: {entry.related_task_name ?? "Nao localizada"}
                          </Pill>
                          <Pill className="border-white/10 bg-white/[0.03] text-white/70">
                            ID da tarefa: {entry.bitrix_task_id_raw ?? entry.task_id ?? "Sem ID"}
                          </Pill>
                          <Pill className="border-white/10 bg-white/[0.03] text-white/70">
                            Status da tarefa: {formatTaskStatus(entry.related_task_status)}
                          </Pill>
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-sm font-semibold text-white">Motivo da revisao</p>
                        <p className="mt-2 text-sm leading-6 text-white/55">{entry.meaning}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-white/60">
                        <Pill className="border-white/10 bg-white/[0.03] text-white/70">
                          Detectado em: {formatDateTime(entry.orphan_detected_at)}
                        </Pill>
                        <Pill className="border-white/10 bg-white/[0.03] text-white/70">
                          Atualizado em: {formatDateTime(entry.updated_at)}
                        </Pill>
                        <Pill className="border-white/10 bg-white/[0.03] text-white/70">
                          Exibicao: {getVisibilityLabel(entry.visibility_mode)}
                        </Pill>
                        <Pill className="border-white/10 bg-white/[0.03] text-white/70">
                          Revisao: {getStatusLabel(entry.review_status)}
                        </Pill>
                      </div>
                      {entry.related_task_responsible ? (
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-white/55">
                          <strong className="font-semibold text-white">Responsavel da tarefa:</strong> {entry.related_task_responsible}
                        </div>
                      ) : null}
                      {entry.comment_text ? (
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-white/55">
                          <strong className="font-semibold text-white">Comentario do lancamento:</strong> {entry.comment_text}
                        </div>
                      ) : null}
                      {entry.admin_note ? (
                        <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-4 text-sm leading-6 text-sky-100">
                          <strong className="font-semibold">Observacao administrativa:</strong> {entry.admin_note}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col gap-2 xl:w-[220px]">
                      <Button
                        type="button"
                        variant="outline"
                        className="justify-start border-white/10 bg-white/5 text-white hover:bg-white/10"
                        onClick={() => setDialogState({ type: "elapsed", item: entry })}
                      >
                        <ShieldAlert className="h-4 w-4" />
                        Revisar lancamento
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {elapsedTotalPages > 1 ? (
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[hsl(228_25%_10%/0.9)] px-4 py-3">
                  <p className="text-sm text-white/55">
                    Pagina {elapsedPage} de {elapsedTotalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={elapsedPage <= 1}
                      onClick={() => setElapsedPage((current) => Math.max(1, current - 1))}
                      className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                    >
                      Anterior
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={elapsedPage >= elapsedTotalPages}
                      onClick={() => setElapsedPage((current) => Math.min(elapsedTotalPages, current + 1))}
                      className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                    >
                      Proxima
                    </Button>
                  </div>
                </div>
              ) : null}
              </>
            )}
          </TabsContent>

          <TabsContent value="sync" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-[hsl(228_25%_10%/0.9)] p-5">
                <div className="flex items-center gap-2 text-white">
                  <Clock3 className="h-4 w-4 text-sky-200" />
                  <h2 className="text-base font-semibold">Ultimas execucoes</h2>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-sm font-semibold text-white">Rotina de tarefas e projetos</p>
                    <p className="mt-2 text-sm leading-6 text-white/55">
                      Ultima execucao em {formatDateTime(payload?.sync.latest_tasks_run?.started_at)} com status{" "}
                      <strong className="text-white">{payload?.sync.latest_tasks_run?.status ?? "sem registro"}</strong>.
                    </p>
                    <p className="mt-2 text-xs text-white/45">
                      Duracao: {formatDuration(payload?.sync.latest_tasks_run?.duration_ms)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-sm font-semibold text-white">Rotina de tempos lancados</p>
                    <p className="mt-2 text-sm leading-6 text-white/55">
                      Ultima execucao em {formatDateTime(payload?.sync.latest_times_run?.started_at)} com status{" "}
                      <strong className="text-white">{payload?.sync.latest_times_run?.status ?? "sem registro"}</strong>.
                    </p>
                    <p className="mt-2 text-xs text-white/45">
                      Duracao: {formatDuration(payload?.sync.latest_times_run?.duration_ms)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[hsl(228_25%_10%/0.9)] p-5">
                <div className="flex items-center gap-2 text-white">
                  <CalendarClock className="h-4 w-4 text-amber-200" />
                  <h2 className="text-base font-semibold">Agendamentos ativos</h2>
                </div>
                <div className="mt-4 space-y-3">
                  {(payload?.sync.configs ?? []).map((config) => (
                    <div key={config.job_name} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{config.job_name}</p>
                          <p className="mt-1 text-xs text-white/45">
                            Cron: {config.cron_expression} • {summarizeCron(config.cron_expression)}
                          </p>
                        </div>
                        <Pill className={config.enabled ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-white/[0.03] text-white/60"}>
                          {config.enabled ? "Ativo" : "Desativado"}
                        </Pill>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-white/55">
                        Ultimo disparo programado: {formatDateTime(config.last_scheduled_at)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[hsl(228_25%_10%/0.9)] p-5">
              <div className="flex items-center gap-2 text-white">
                <AlertTriangle className="h-4 w-4 text-red-200" />
                <h2 className="text-base font-semibold">Historico recente</h2>
              </div>
              <div className="mt-4 space-y-3">
                {(payload?.sync.recent_runs ?? []).map((run, index) => (
                  <div key={`${run.job_name}-${run.started_at}-${index}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">{run.job_name}</p>
                        <p className="mt-1 text-xs text-white/45">
                          Iniciou em {formatDateTime(run.started_at)} • Duracao {formatDuration(run.duration_ms)}
                        </p>
                      </div>
                      <Pill className={run.status === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100" : "border-red-500/30 bg-red-500/10 text-red-100"}>
                        {run.status}
                      </Pill>
                    </div>
                    {run.error_message ? (
                      <p className="mt-3 text-sm leading-6 text-red-100">{run.error_message}</p>
                    ) : (
                      <p className="mt-3 text-sm leading-6 text-white/55">
                        Execucao concluida sem erro registrado.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={Boolean(dialogState)} onOpenChange={(open) => !open && setDialogState(null)}>
        <DialogContent className="border-white/10 bg-[hsl(230_28%_11%)] text-white sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {dialogState?.type === "task" ? "Revisar tarefa da central" : "Revisar lancamento sem vinculo"}
            </DialogTitle>
            <DialogDescription className="text-white/55">
              Defina se esse caso continua isolado na central, se pode voltar para a operacao ou se deve ser removido da base local.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-white">
                {dialogState?.type === "task"
                  ? dialogState.item.title
                  : `${dialogState?.item.label ?? "Lancamento sem vinculo"} #${dialogState?.type === "elapsed" ? dialogState.item.id : ""}`}
              </p>
              <p className="mt-2 text-sm leading-6 text-white/55">
                {dialogState?.type === "task"
                  ? dialogState.item.problems.map((problem) => problem.meaning).join(" ")
                  : dialogState?.item.meaning}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white" htmlFor="visibility-mode">
                Destino do caso
              </label>
              <select
                id="visibility-mode"
                value={visibilityMode}
                onChange={(event) => setVisibilityMode(event.target.value as VisibilityMode)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none"
              >
                {visibilityOptions.map((option) => (
                  <option key={option.value} value={option.value} className="bg-slate-900 text-white">
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs leading-5 text-white/45">
                {visibilityOptions.find((option) => option.value === visibilityMode)?.helper}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white" htmlFor="review-status">
                Etapa da revisao
              </label>
              <select
                id="review-status"
                value={reviewStatus}
                onChange={(event) => setReviewStatus(event.target.value as ReviewStatus)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none"
              >
                {reviewOptions.map((option) => (
                  <option key={option.value} value={option.value} className="bg-slate-900 text-white">
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white" htmlFor="admin-note">
                Observacao administrativa
              </label>
              <textarea
                id="admin-note"
                value={adminNote}
                onChange={(event) => setAdminNote(event.target.value)}
                rows={5}
                placeholder="Ex.: atividade arquivada na origem, manter apenas para historico."
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-white outline-none placeholder:text-white/25"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={saving}
              className="sm:mr-auto"
            >
              <Trash2 className="h-4 w-4" />
              Excluir da base local
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogState(null)}
                disabled={saving}
                className="border-white/10 bg-white/5 text-white hover:bg-white/10"
              >
                Cancelar
              </Button>
              <Button type="button" onClick={() => void submitReview()} disabled={saving}>
                {saving ? "Salvando..." : "Salvar revisao"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
