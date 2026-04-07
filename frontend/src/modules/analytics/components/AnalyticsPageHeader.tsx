import { RefreshCw, FileDown, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  effectiveUser?: string;
  periodLabel?: string;
  lastUpdatedText: string;
  refreshing: boolean;
  onExportPdf: () => void;
  onRefresh: () => void;
  canExport: boolean;
  canRefresh: boolean;
  refreshDisabled: boolean;
  refreshTitle: string;
  reloadsRemainingThisMinute: number;
  isCliente: boolean;
}

export default function AnalyticsPageHeader({
  effectiveUser,
  periodLabel,
  lastUpdatedText,
  refreshing,
  onExportPdf,
  onRefresh,
  canExport,
  canRefresh,
  refreshDisabled,
  refreshTitle,
  reloadsRemainingThisMinute,
  isCliente,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative overflow-hidden rounded-2xl border border-white/[0.07]"
      style={{
        background:
          "linear-gradient(135deg, hsl(260 30% 11%) 0%, hsl(262 35% 15%) 40%, hsl(270 25% 12%) 100%)",
      }}
    >

      <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 p-4 sm:p-5 md:px-6 md:py-5">
        {/* Identity group */}
        <div className="flex items-center gap-3.5 flex-1 min-w-0">
          <motion.div
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] shrink-0 backdrop-blur-sm shadow-lg shadow-black/30"
            style={{
              background: "linear-gradient(145deg, hsl(262 60% 25% / 0.5), hsl(262 40% 18% / 0.4))",
            }}
            animate={{
              boxShadow: [
                "0 0 12px 0px hsl(262 83% 58% / 0.1)",
                "0 0 20px 2px hsl(262 83% 58% / 0.2)",
                "0 0 12px 0px hsl(262 83% 58% / 0.1)",
              ],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <motion.div
              animate={{ rotate: [0, -8, 8, -4, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", repeatDelay: 2 }}
            >
              <BarChart3 className="h-5 w-5 text-primary" />
            </motion.div>
          </motion.div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground tracking-tight leading-tight">
              Analíticas
            </h1>
            <p className="mt-0.5 text-xs sm:text-sm text-white/35 line-clamp-1">
              {effectiveUser
                ? `Projetos de ${effectiveUser}`
                : "Visão geral de desempenho dos projetos"}
              {periodLabel && (
                <span className="text-white/20"> · {periodLabel}</span>
              )}
            </p>
          </div>
        </div>

        {/* Actions group — stacked: status on top, buttons below */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {!isCliente && canExport && (
              <button
                type="button"
                onClick={onExportPdf}
                className="group flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-white/50 transition-all hover:border-emerald-500/30 hover:bg-emerald-500/[0.06] hover:text-emerald-400 disabled:opacity-40"
                title="Exportar PDF"
              >
                <FileDown className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
                <span className="hidden sm:inline">PDF</span>
              </button>
            )}
            {!isCliente && canRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshDisabled}
                title={refreshTitle}
                className="group flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-white/50 transition-all hover:border-white/[0.15] hover:bg-white/[0.05] hover:text-white/70 disabled:opacity-40"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 transition-transform group-hover:scale-110 ${
                    refreshing ? "animate-spin" : ""
                  }`}
                />
                <span className="hidden sm:inline">
                  {refreshing
                    ? "Atualizando..."
                    : reloadsRemainingThisMinute <= 0
                    ? "Limite atingido"
                    : "Atualizar"}
                </span>
                {reloadsRemainingThisMinute > 0 &&
                  reloadsRemainingThisMinute < 5 &&
                  !refreshing && (
                    <span className="opacity-50">
                      ({reloadsRemainingThisMinute})
                    </span>
                  )}
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
