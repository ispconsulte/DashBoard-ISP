import { AlertCircle, LogIn, RefreshCw, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";
import { storage } from "@/modules/shared/storage";

interface DataErrorCardProps {
  /** Short user-friendly title */
  title?: string;
  /** Detail message */
  message?: string;
  /** Retry callback — shows a button when provided */
  onRetry?: () => void;
  /** Compact mode for inline use inside grids */
  compact?: boolean;
}

/** Check if an error message is auth/JWT related */
function isAuthError(message?: string): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("jwt expired") ||
    lower.includes("jwt") ||
    lower.includes("pgrst301") ||
    lower.includes("pgrst303") ||
    lower.includes("sessão expirou") ||
    lower.includes("token") ||
    lower.includes("unauthorized") ||
    lower.includes("invalid claim")
  );
}

/**
 * Standardised error display for failed data loads / chart errors.
 * Auth errors get a polished full-width re-login card.
 */
export default function DataErrorCard({
  title,
  message,
  onRetry,
  compact = false,
}: DataErrorCardProps) {
  const authError = isAuthError(message);
  const displayTitle = title ?? (authError ? "Sessão expirada" : "Erro ao carregar dados");
  const displayMessage = authError
    ? "Sua sessão expirou. Faça login novamente para continuar acessando os dados."
    : (message ?? "Não foi possível obter as informações. Tente novamente em alguns instantes.");

  /* ── Auth error: polished re-login card ── */
  if (authError) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="flex items-center justify-center w-full min-h-[260px] p-6"
      >
        <div
          className="relative w-full max-w-sm rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(145deg, hsl(270 50% 13%), hsl(234 45% 8%))",
            boxShadow: "0 24px 48px -12px hsl(262 83% 20% / 0.4), 0 0 0 1px hsl(262 83% 58% / 0.1)",
          }}
        >
          {/* Top accent bar */}
          <div className="h-[2px] w-full bg-gradient-to-r from-amber-500 via-[hsl(262_83%_58%)] to-transparent opacity-70" />

          <div className="px-6 py-8 flex flex-col items-center gap-5 text-center">
            {/* Icon */}
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/[0.1] border border-amber-500/20">
              <ShieldAlert className="h-7 w-7 text-amber-400" />
            </div>

            {/* Text */}
            <div className="space-y-2">
              <h3 className="text-base font-bold text-white/90">{displayTitle}</h3>
              <p className="text-sm text-white/45 leading-relaxed max-w-[280px]">
                {displayMessage}
              </p>
            </div>

            {/* Re-login button */}
            <button
              type="button"
              onClick={() => {
                storage.remove("auth_session");
                window.location.href = "/login";
              }}
              className="flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white transition-all hover:opacity-90"
              style={{
                background: "linear-gradient(135deg, hsl(262 83% 58%), hsl(234 89% 64%))",
                boxShadow: "0 8px 24px -6px hsl(262 83% 58% / 0.4)",
              }}
            >
              <LogIn className="h-4 w-4" />
              Fazer login novamente
            </button>

            {/* Subtle hint */}
            <p className="text-[11px] text-white/25">
              Sua sessão é renovada automaticamente ao efetuar login.
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  /* ── Standard data error ── */
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className={`flex flex-col items-center justify-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/[0.06] text-center ${
        compact ? "p-4" : "p-8"
      }`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-5 w-5 text-destructive" />
      </div>
      <div className="space-y-1">
        <p className={`font-semibold text-foreground ${compact ? "text-sm" : "text-base"}`}>
          {displayTitle}
        </p>
        <p className={`text-muted-foreground ${compact ? "text-xs" : "text-sm"} max-w-md`}>
          {displayMessage}
        </p>
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-xs font-medium text-foreground/70 transition hover:bg-white/[0.08] hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Tentar novamente
        </button>
      ) : null}
    </motion.div>
  );
}
