import { IntegrationWithState } from "@/modules/integrations/types/integration";
import { Zap, Clock, CheckCircle2, ExternalLink } from "lucide-react";

type IntegrationCardProps = {
  integration: IntegrationWithState;
  onSelect: (integration: IntegrationWithState) => void;
  canManage?: boolean;
};

const statusStyles: Record<
  IntegrationWithState["status"],
  { label: string; className: string; icon: React.ReactNode }
> = {
  DISPONIVEL: {
    label: "Disponível",
    className: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    icon: <Zap className="h-3 w-3" />,
  },
  EM_BREVE: {
    label: "Em breve",
    className: "bg-amber-500/10 text-amber-200 border border-amber-500/20",
    icon: <Clock className="h-3 w-3" />,
  },
  CONECTADO: {
    label: "Conectado",
    className: "bg-[hsl(var(--task-purple)/0.15)] text-[hsl(var(--task-purple))] border border-[hsl(var(--task-purple)/0.3)]",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
};

export function IntegrationCard({
  integration,
  onSelect,
  canManage = true,
}: IntegrationCardProps) {
  const status = statusStyles[integration.status];
  const connectedName = integration.activeProfile || integration.config?.profileName?.trim();
  const isDisabled = integration.status === "EM_BREVE";

  const helperText = !canManage
    ? "Somente administradores podem conectar ou desconectar."
    : integration.status === "CONECTADO"
      ? connectedName
        ? `Conectado em ${connectedName}.`
        : "Configuração ativa."
      : integration.status === "EM_BREVE"
        ? "Fique ligado!"
        : "Conecte para começar.";

  const actionLabel =
    !canManage && integration.status !== "CONECTADO"
      ? "Ver detalhes"
      : integration.status === "CONECTADO"
        ? "Gerenciar"
        : integration.status === "DISPONIVEL"
          ? "Conectar"
          : "Em breve";

  return (
    <div className="group relative flex h-full flex-col rounded-2xl border border-[hsl(var(--task-border))] bg-[hsl(var(--task-surface))] p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-[hsl(var(--task-purple)/0.4)] hover:shadow-[0_20px_50px_-20px_hsl(262_83%_58%/0.15)]">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-base font-bold text-[hsl(var(--task-text))]">{integration.name}</h3>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${status.className}`}
        >
          {status.icon}
          {integration.status === "CONECTADO" && connectedName ? connectedName : status.label}
        </span>
      </div>

      {/* Description — flex-1 pushes footer down */}
      <p className="flex-1 text-[13px] leading-relaxed text-[hsl(var(--task-text-muted))]">
        {integration.description}
      </p>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[hsl(var(--task-border)/0.5)] pt-4">
        <span className="text-[11px] text-[hsl(var(--task-text-muted)/0.6)]">{helperText}</span>
        <button
          onClick={() => onSelect(integration)}
          disabled={isDisabled}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-200 ${
            isDisabled
              ? "cursor-not-allowed border border-[hsl(var(--task-border))] bg-[hsl(var(--task-surface))] text-[hsl(var(--task-text-muted)/0.4)]"
              : integration.status === "CONECTADO"
                ? "border border-[hsl(var(--task-purple)/0.4)] bg-[hsl(var(--task-purple)/0.12)] text-[hsl(var(--task-purple))] hover:bg-[hsl(var(--task-purple)/0.2)] hover:shadow-lg hover:shadow-[hsl(var(--task-purple)/0.15)]"
                : "bg-gradient-to-r from-[hsl(262_83%_58%)] to-[hsl(234_89%_64%)] text-white shadow-lg shadow-[hsl(262_83%_58%/0.25)] hover:shadow-[hsl(262_83%_58%/0.4)] hover:scale-[1.03] active:scale-[0.98]"
          }`}
        >
          {integration.status === "CONECTADO" ? (
            <ExternalLink className="h-3 w-3" />
          ) : integration.status === "DISPONIVEL" ? (
            <Zap className="h-3 w-3" />
          ) : null}
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
