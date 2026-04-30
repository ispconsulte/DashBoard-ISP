import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { IntegrationCard } from "@/modules/integrations/components/IntegrationCard";
import { IntegrationModal } from "@/modules/integrations/components/IntegrationModal";
import { useIntegrations } from "@/modules/integrations/hooks/useIntegrations";
import { IntegrationWithState } from "@/modules/integrations/types/integration";
import {
  fetchIntegrityDashboard,
  triggerIntegritySync,
  type IntegrityPayload,
  type TriggerSyncPayload,
} from "@/modules/diagnostics/api/adminDiagnosticsApi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  Search,
  Plug,
  Zap,
  Globe,
  Shield,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { usePageSEO } from "@/hooks/usePageSEO";
import { toast } from "sonner";

const BITRIX_MANUAL_SYNC_COOLDOWN_MS = 5 * 60 * 1000;
const BITRIX_MANUAL_SYNC_COOLDOWN_KEY = "integrations:bitrix_manual_sync_next_allowed_at";
const BITRIX_LAST_SYNC_REPORT_KEY = "integrations:bitrix_last_sync_report";

type SyncPhase = "idle" | "preparing" | "tasks" | "times" | "done" | "error";

type SyncSummary = {
  label: string;
  before: number;
  after: number | null;
};

type SyncReport = {
  startedAt: string;
  finishedAt?: string;
  phase: SyncPhase;
  error?: string | null;
  before?: IntegrityPayload["overview"] | null;
  after?: IntegrityPayload["overview"] | null;
  tasksJob?: TriggerSyncPayload["jobs"][number] | null;
  timesJob?: TriggerSyncPayload["jobs"][number] | null;
};

const readNextAllowedSyncAt = () => {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(BITRIX_MANUAL_SYNC_COOLDOWN_KEY);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

const readLastSyncReport = (): SyncReport | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BITRIX_LAST_SYNC_REPORT_KEY);
    return raw ? (JSON.parse(raw) as SyncReport) : null;
  } catch {
    return null;
  }
};

const saveLastSyncReport = (report: SyncReport) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BITRIX_LAST_SYNC_REPORT_KEY, JSON.stringify(report));
};

const formatCooldown = (ms: number) => {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const formatNumber = (value?: number | null) =>
  new Intl.NumberFormat("pt-BR").format(Number(value ?? 0));

const formatDateTime = (value?: string | null) => {
  if (!value) return "Sem execução";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sem execução";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(parsed);
};

const formatDuration = (ms?: number | null) => {
  if (!ms || ms <= 0) return "0s";
  const seconds = Math.round(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes ? `${minutes}min ${rest}s` : `${rest}s`;
};

export default function IntegracoesPage() {
  usePageSEO("/integracoes");
  const { session } = useAuth();
  const isAdmin = session?.role === "admin";

  const {
    filteredIntegrations,
    searchTerm,
    setSearchTerm,
    loading: loadingIntegrations,
    connectIntegration,
    disconnectIntegration,
  } = useIntegrations(session?.email ?? null, { canManage: isAdmin });

  const [selectedIntegration, setSelectedIntegration] =
    useState<IntegrationWithState | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [syncingBitrix, setSyncingBitrix] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [syncReport, setSyncReport] = useState<SyncReport | null>(() => readLastSyncReport());
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [nextAllowedSyncAt, setNextAllowedSyncAt] = useState(readNextAllowedSyncAt);

  const openModal = (integration: IntegrationWithState) => {
    setSelectedIntegration(integration);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedIntegration(null);
  };

  const connectedCount = filteredIntegrations.filter((i) => i.status === "CONECTADO").length;
  const availableCount = filteredIntegrations.filter((i) => i.status === "DISPONIVEL").length;
  const comingSoonCount = filteredIntegrations.filter((i) => i.status === "EM_BREVE").length;
  const syncCooldownMs = Math.max(0, nextAllowedSyncAt - nowMs);
  const canForceBitrixSync = isAdmin && !syncingBitrix && syncCooldownMs === 0;
  const syncButtonLabel = useMemo(() => {
    if (syncingBitrix) return "Atualizando...";
    if (syncCooldownMs > 0) return `Aguarde ${formatCooldown(syncCooldownMs)}`;
    return "Forçar atualizações";
  }, [syncingBitrix, syncCooldownMs]);

  useEffect(() => {
    if (!isAdmin) return;
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
      setNextAllowedSyncAt(readNextAllowedSyncAt());
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [isAdmin]);

  const updateSyncReport = (updater: (current: SyncReport | null) => SyncReport) => {
    setSyncReport((current) => {
      const next = updater(current);
      saveLastSyncReport(next);
      return next;
    });
  };

  const invokeBitrixSync = async () => {
    const token = session?.accessToken;
    if (!token) {
      throw new Error("Sessão expirada. Faça login novamente.");
    }

    const startedAt = new Date().toISOString();
    updateSyncReport(() => ({
      startedAt,
      phase: "preparing",
      error: null,
      before: null,
      after: null,
      tasksJob: null,
      timesJob: null,
    }));

    const before = await fetchIntegrityDashboard(token);
    updateSyncReport((current) => ({
      ...(current ?? { startedAt: new Date().toISOString(), phase: "preparing" }),
      before: before.overview,
      phase: "tasks",
    }));

    const tasksPayload = await triggerIntegritySync(token, ["tasks"]);
    const tasksJob = tasksPayload.jobs[0] ?? null;
    if (!tasksJob?.ok) {
      throw new Error(tasksJob?.error || "Falha ao atualizar tarefas e projetos.");
    }

    updateSyncReport((current) => ({
      ...(current ?? { startedAt: new Date().toISOString(), phase: "tasks" }),
      tasksJob,
      after: tasksPayload.dashboard.overview,
      phase: "times",
    }));

    const timesPayload = await triggerIntegritySync(token, ["times"]);
    const timesJob = timesPayload.jobs[0] ?? null;
    if (!timesJob?.ok) {
      throw new Error(timesJob?.error || "Falha ao atualizar horas.");
    }

    const finishedReport: SyncReport = {
      startedAt,
      finishedAt: new Date().toISOString(),
      phase: "done",
      error: null,
      before: before.overview,
      after: timesPayload.dashboard.overview,
      tasksJob,
      timesJob,
    };

    setSyncReport(finishedReport);
    saveLastSyncReport(finishedReport);

    return timesPayload;
  };

  const handleForceBitrixSync = async () => {
    if (!isAdmin || syncingBitrix) return;

    const nextAllowedAt = readNextAllowedSyncAt();
    const remainingMs = nextAllowedAt - Date.now();
    if (remainingMs > 0) {
      setNextAllowedSyncAt(nextAllowedAt);
      toast.warning(`Aguarde ${formatCooldown(remainingMs)} para sincronizar novamente.`);
      return;
    }

    setSyncingBitrix(true);
    const nextAllowed = Date.now() + BITRIX_MANUAL_SYNC_COOLDOWN_MS;
    window.localStorage.setItem(BITRIX_MANUAL_SYNC_COOLDOWN_KEY, String(nextAllowed));
    setNextAllowedSyncAt(nextAllowed);
    toast.info("Sincronização Bitrix iniciada.");

    try {
      await invokeBitrixSync();
      toast.success("Sincronização concluída. Tarefas, integridade e horas foram atualizadas.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível forçar a sincronização.";
      updateSyncReport((current) => ({
        ...(current ?? { startedAt: new Date().toISOString() }),
        phase: "error",
        finishedAt: new Date().toISOString(),
        error: message,
      }));
      toast.error(message);
    } finally {
      setSyncingBitrix(false);
    }
  };

  return (
    <div className="page-gradient w-full">
      <div className="mx-auto w-full max-w-[1900px] space-y-6 p-4 sm:p-5 md:p-8">
        {/* ── Hero Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl border border-[hsl(var(--task-border))] bg-[hsl(var(--task-surface))]"
        >
          {/* Background glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-[hsl(262_83%_58%/0.12)] blur-[80px]" />
            <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-[hsl(234_89%_64%/0.1)] blur-[60px]" />
          </div>

          <div className="relative flex flex-col gap-6 p-6 md:p-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[hsl(262_83%_58%)] to-[hsl(234_89%_64%)] shadow-xl shadow-[hsl(262_83%_58%/0.35)]">
                <Plug className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[hsl(var(--task-text))] tracking-tight">
                  Integrações
                </h1>
                <p className="mt-1 text-sm text-[hsl(var(--task-text-muted))] max-w-md">
                  Conecte seus serviços favoritos em poucos cliques e automatize seus fluxos de trabalho.
                </p>
              </div>
            </div>

            {/* Stats pills */}
            <div className="flex flex-wrap gap-3">
              <StatPill icon={Zap} label="Conectadas" value={connectedCount} color="emerald" />
              <StatPill icon={Globe} label="Disponíveis" value={availableCount} color="indigo" />
              <StatPill icon={Sparkles} label="Em breve" value={comingSoonCount} color="amber" />
            </div>
          </div>
        </motion.div>

        {/* ── Search Bar ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--task-text-muted)/0.5)]" />
            <input
              type="search"
              value={searchTerm}
              placeholder="Buscar integrações..."
              onChange={(event) => setSearchTerm(event.target.value)}
              className="h-10 w-full rounded-xl border border-[hsl(var(--task-border))] bg-[hsl(var(--task-surface))] pl-10 pr-4 text-sm text-[hsl(var(--task-text))] outline-none ring-2 ring-transparent transition focus:border-[hsl(var(--task-purple)/0.5)] focus:ring-[hsl(var(--task-purple)/0.2)] placeholder:text-[hsl(var(--task-text-muted)/0.4)]"
            />
          </div>
        </motion.div>

        {isAdmin ? (
          <SyncControlCard
            syncing={syncingBitrix}
            disabled={!canForceBitrixSync}
            buttonLabel={syncButtonLabel}
            cooldownMs={syncCooldownMs}
            report={syncReport}
            onForce={handleForceBitrixSync}
            onOpenProgress={() => setProgressOpen(true)}
          />
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-2.5 text-xs text-amber-200/90">
            <Shield className="h-4 w-4 shrink-0 text-amber-400" />
            <span>Apenas administradores podem gerenciar integrações.</span>
          </div>
        )}

        {/* ── Cards Grid ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {loadingIntegrations ? (
            Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-44 animate-pulse rounded-2xl border border-[hsl(var(--task-border))] bg-[hsl(var(--task-surface))]"
              />
            ))
          ) : filteredIntegrations.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[hsl(var(--task-border))] bg-[hsl(var(--task-surface)/0.5)] px-6 py-16 text-center">
              <Search className="h-10 w-10 text-[hsl(var(--task-text-muted)/0.3)]" />
              <p className="text-sm text-[hsl(var(--task-text-muted))]">
                Nenhuma integração encontrada para "<span className="font-semibold text-[hsl(var(--task-text))]">{searchTerm}</span>".
              </p>
            </div>
          ) : (
            filteredIntegrations.map((integration, index) => (
              <motion.div
                key={integration.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * index }}
              >
                <IntegrationCard
                  integration={integration}
                  canManage={isAdmin}
                  onSelect={openModal}
                />
              </motion.div>
            ))
          )}
        </motion.div>
      </div>

      <IntegrationModal
        key={selectedIntegration?.id ?? "sem-integracao"}
        open={isModalOpen}
        integration={selectedIntegration}
        readOnly={!isAdmin}
        readOnlyReason="Somente administradores podem conectar ou desconectar integrações."
        onClose={closeModal}
        onSave={connectIntegration}
        onDisconnect={disconnectIntegration}
      />

      <SyncProgressModal
        open={progressOpen}
        onOpenChange={setProgressOpen}
        report={syncReport}
        syncing={syncingBitrix}
      />
    </div>
  );
}

function SyncControlCard({
  syncing,
  disabled,
  buttonLabel,
  cooldownMs,
  report,
  onForce,
  onOpenProgress,
}: {
  syncing: boolean;
  disabled: boolean;
  buttonLabel: string;
  cooldownMs: number;
  report: SyncReport | null;
  onForce: () => void;
  onOpenProgress: () => void;
}) {
  const lastStatus =
    report?.phase === "done"
      ? "Concluída"
      : report?.phase === "error"
        ? "Falhou"
        : syncing
          ? "Em andamento"
          : "Aguardando";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.16 }}
      className="rounded-2xl border border-[hsl(var(--task-border))] bg-[hsl(var(--task-surface))] p-4"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
            <Database className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-[hsl(var(--task-text))]">Atualização Bitrix</h2>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] text-[hsl(var(--task-text-muted))]">
                {lastStatus}
              </span>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-[hsl(var(--task-text-muted))]">
              Atualiza projetos, tarefas, integridade e horas lançadas.
            </p>
            <p className="mt-1 text-xs text-[hsl(var(--task-text-muted)/0.75)]">
              Última conclusão: {formatDateTime(report?.finishedAt)}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onOpenProgress}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-[hsl(var(--task-text))] transition hover:bg-white/[0.08]"
          >
            <Activity className="h-4 w-4 text-cyan-300" />
            Progresso
          </button>
          <button
            type="button"
            onClick={onForce}
            disabled={disabled}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[hsl(var(--task-purple)/0.35)] bg-[hsl(var(--task-purple)/0.14)] px-4 text-sm font-semibold text-[hsl(var(--task-purple))] transition hover:bg-[hsl(var(--task-purple)/0.22)] disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {buttonLabel}
          </button>
        </div>
      </div>

      {cooldownMs > 0 && !syncing && (
        <div className="mt-3 flex items-center gap-2 text-xs text-[hsl(var(--task-text-muted)/0.75)]">
          <Clock3 className="h-3.5 w-3.5 text-[hsl(var(--task-purple))]" />
          <span>Nova atualização manual disponível em {formatCooldown(cooldownMs)}.</span>
        </div>
      )}
    </motion.div>
  );
}

function SyncProgressModal({
  open,
  onOpenChange,
  report,
  syncing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: SyncReport | null;
  syncing: boolean;
}) {
  const phase = report?.phase ?? "idle";
  const hasFinalSnapshot = Boolean(report?.after && (phase === "done" || phase === "error"));
  const summaries: SyncSummary[] = [
    {
      label: "Tarefas totais",
      before: report?.before?.total_tasks ?? 0,
      after: hasFinalSnapshot ? report?.after?.total_tasks ?? null : null,
    },
    {
      label: "Casos de integridade",
      before: report?.before?.problematic_tasks ?? 0,
      after: hasFinalSnapshot ? report?.after?.problematic_tasks ?? null : null,
    },
    {
      label: "Horas sem vínculo",
      before: report?.before?.orphan_elapsed_entries ?? 0,
      after: hasFinalSnapshot ? report?.after?.orphan_elapsed_entries ?? null : null,
    },
  ];

  const tasksData = report?.tasksJob?.data ?? null;
  const timesData = report?.timesJob?.data ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[hsl(230_28%_11%)] p-0 text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:max-w-2xl">
        <DialogHeader className="border-b border-white/[0.08] px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
              <Activity className="h-4 w-4" />
            </span>
            Progresso da atualização
          </DialogTitle>
          <DialogDescription className="text-white/45">
            Acompanhamento da execução manual do Bitrix.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 pb-5 pt-4">
          {!report ? (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-8 text-center text-sm text-white/50">
              Nenhuma atualização manual registrada nesta sessão.
            </div>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-4">
                <ProgressStep label="Preparando" active={phase === "preparing"} done={["tasks", "times", "done"].includes(phase)} />
                <ProgressStep label="Tarefas" active={phase === "tasks"} done={["times", "done"].includes(phase)} />
                <ProgressStep label="Horas" active={phase === "times"} done={phase === "done"} />
                <ProgressStep label="Final" active={phase === "done" || phase === "error"} done={phase === "done"} error={phase === "error"} />
              </div>

              {syncing && !hasFinalSnapshot && (
                <div className="rounded-xl border border-cyan-400/15 bg-cyan-400/[0.06] px-4 py-3 text-sm text-cyan-50/80">
                  A atualização está em andamento. O comparativo de depois aparece somente quando as rotinas terminarem.
                </div>
              )}

              {report.error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{report.error}</span>
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-3">
                {summaries.map((item) => (
                  <BeforeAfterStat key={item.label} item={item} />
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <JobResult
                  title="Projetos e tarefas"
                  running={syncing && ["preparing", "tasks"].includes(phase)}
                  ok={report.tasksJob?.ok}
                  rows={[
                    ["Projetos", tasksData ? formatNumber(Number(tasksData.projects ?? 0)) : "--"],
                    ["Tarefas lidas", tasksData ? formatNumber(Number(tasksData.tasks ?? 0)) : "--"],
                    ["Duração", `${tasksData?.duration_seconds ?? "-"}s`],
                  ]}
                />
                <JobResult
                  title="Horas lançadas"
                  running={syncing && phase === "times"}
                  ok={report.timesJob?.ok}
                  rows={[
                    ["Registros novos", timesData ? formatNumber(Number(timesData.elapsed_upserted ?? 0)) : "--"],
                    ["Horas sem vínculo", timesData ? formatNumber(Number(timesData.orphan_rows_detected ?? 0)) : "--"],
                    ["Duração", `${timesData?.duration_seconds ?? "-"}s`],
                  ]}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/40">
                <span>Início: {formatDateTime(report.startedAt)}</span>
                <span>Fim: {formatDateTime(report.finishedAt)}</span>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProgressStep({ label, active, done, error }: { label: string; active?: boolean; done?: boolean; error?: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
        error
          ? "border-red-500/30 bg-red-500/10 text-red-100"
          : done
            ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
            : active
              ? "border-cyan-400/25 bg-cyan-400/10 text-cyan-100"
              : "border-white/[0.08] bg-white/[0.03] text-white/35"
      }`}
    >
      {error ? (
        <AlertTriangle className="h-3.5 w-3.5" />
      ) : done ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : active ? (
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Clock3 className="h-3.5 w-3.5" />
      )}
      {label}
    </div>
  );
}

function BeforeAfterStat({ item }: { item: SyncSummary }) {
  const hasAfter = item.after !== null;
  const diff = hasAfter ? item.after - item.before : null;
  const diffLabel = !hasAfter
    ? "aguardando conclusão"
    : diff === 0
      ? "sem variação"
      : `${diff > 0 ? "+" : ""}${formatNumber(diff)}`;

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">{item.label}</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[11px] text-white/35">Antes</p>
          <p className="text-lg font-bold text-white/75">{formatNumber(item.before)}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-white/35">Depois</p>
          <p className={`text-lg font-bold ${hasAfter ? "text-white" : "text-white/25"}`}>
            {hasAfter ? formatNumber(item.after) : "--"}
          </p>
        </div>
      </div>
      <p className={`mt-2 text-xs ${!hasAfter || diff === 0 ? "text-white/35" : diff > 0 ? "text-cyan-200" : "text-emerald-200"}`}>
        {diffLabel}
      </p>
    </div>
  );
}

function JobResult({
  title,
  rows,
  running,
  ok,
}: {
  title: string;
  rows: Array<[string, string]>;
  running?: boolean;
  ok?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <span className={`rounded-full px-2 py-0.5 text-[11px] ${
          running
            ? "bg-cyan-400/10 text-cyan-100"
            : ok
              ? "bg-emerald-500/10 text-emerald-200"
              : "bg-white/[0.06] text-white/35"
        }`}>
          {running ? "Rodando" : ok ? "Concluído" : "Aguardando"}
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-white/45">{label}</span>
            <span className="font-semibold text-white/80">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Stat Pill ── */
function StatPill({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: "emerald" | "indigo" | "amber";
}) {
  const colorMap = {
    emerald: {
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      text: "text-emerald-400",
      icon: "text-emerald-400",
    },
    indigo: {
      bg: "bg-[hsl(var(--task-purple)/0.1)]",
      border: "border-[hsl(var(--task-purple)/0.2)]",
      text: "text-[hsl(var(--task-purple))]",
      icon: "text-[hsl(var(--task-purple))]",
    },
    amber: {
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      text: "text-amber-400",
      icon: "text-amber-400",
    },
  };
  const c = colorMap[color];

  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border ${c.border} ${c.bg} px-4 py-2.5`}
    >
      <Icon className={`h-4 w-4 ${c.icon}`} />
      <div className="flex items-baseline gap-1.5">
        <span className={`text-lg font-bold ${c.text}`}>{value}</span>
        <span className="text-[11px] text-[hsl(var(--task-text-muted))]">{label}</span>
      </div>
    </div>
  );
}
