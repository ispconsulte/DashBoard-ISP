import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { IntegrationCard } from "@/modules/integrations/components/IntegrationCard";
import { IntegrationModal } from "@/modules/integrations/components/IntegrationModal";
import { useIntegrations } from "@/modules/integrations/hooks/useIntegrations";
import { IntegrationWithState } from "@/modules/integrations/types/integration";
import {
  Search, Plug, Zap, Globe, Shield, Sparkles,
} from "lucide-react";
import { usePageSEO } from "@/hooks/usePageSEO";

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

        {/* ── Search & Warning Bar ── */}
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

          {!isAdmin && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-2.5 text-xs text-amber-200/90">
              <Shield className="h-4 w-4 shrink-0 text-amber-400" />
              <span>Apenas administradores podem gerenciar integrações.</span>
            </div>
          )}
        </motion.div>

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
