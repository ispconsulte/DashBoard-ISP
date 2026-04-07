import { motion } from "framer-motion";
import { Inbox, BarChart3, Users, Clock, type LucideIcon } from "lucide-react";

type Variant = "chart" | "table" | "users" | "timeline" | "default";

interface EmptyStateProps {
  /** Message shown to the user */
  message?: string;
  /** Optional sub-message with extra context */
  hint?: string;
  /** Visual variant — picks the icon automatically */
  variant?: Variant;
  /** Custom icon override */
  icon?: LucideIcon;
  /** Compact mode for inline/chart areas */
  compact?: boolean;
  className?: string;
}

const VARIANT_ICON: Record<Variant, LucideIcon> = {
  chart: BarChart3,
  table: Inbox,
  users: Users,
  timeline: Clock,
  default: Inbox,
};

const VARIANT_MSG: Record<Variant, string> = {
  chart: "Sem dados suficientes para exibir este gráfico. Ajuste os filtros ou aguarde novos registros.",
  table: "Nenhum registro encontrado.",
  users: "Nenhum usuário encontrado com os filtros atuais.",
  timeline: "Nenhum prazo registrado no período selecionado.",
  default: "Nenhum dado disponível no momento.",
};

/**
 * Friendly animated empty-state placeholder.
 * Replaces raw "Sem dados" messages across the app.
 */
export default function EmptyState({
  message,
  hint,
  variant = "default",
  icon,
  compact = false,
  className = "",
}: EmptyStateProps) {
  const Icon = icon ?? VARIANT_ICON[variant];
  const text = message ?? VARIANT_MSG[variant];

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className={`flex h-full flex-col items-center justify-center gap-2 py-6 ${className}`}
      >
        <motion.div
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <Icon className="h-6 w-6 text-white/15" strokeWidth={1.5} />
        </motion.div>
        <p className="max-w-[200px] text-center text-xs text-white/30">{text}</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`flex flex-col items-center justify-center gap-3 py-10 text-center ${className}`}
    >
      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4"
      >
        <Icon className="h-8 w-8 text-white/20" strokeWidth={1.5} />
      </motion.div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-white/40">{text}</p>
        {hint && <p className="text-xs text-white/20">{hint}</p>}
      </div>
    </motion.div>
  );
}
