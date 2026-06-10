import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ClipboardCheck, X, ArrowRight } from "lucide-react";
import type { BonusNotificationItem } from "@/modules/sprint6/hooks/useBonusEvaluationNotifier";
import { supabaseExt as supabase } from "@/lib/supabase";

interface Props {
  notification: BonusNotificationItem;
  onDismiss: (id: string) => void;
  /** Auto-dismiss after this many ms. Default: 30s */
  autoHideMs?: number;
}

export function BonusEvaluationNotificationCard({
  notification,
  onDismiss,
  autoHideMs = 30_000,
}: Props) {
  const navigate = useNavigate();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => onDismiss(notification.id), autoHideMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [notification.id, autoHideMs, onDismiss]);

  const markOpenedAndNavigate = () => {
    // Navega primeiro: o onDismiss desmonta este card, entao qualquer await antes
    // do navigate impedia a navegacao de acontecer. O update do banco vira
    // fire-and-forget (nao bloqueia a ida para a tela da avaliacao).
    navigate("/admin/testes/bonificacao");
    const now = new Date().toISOString();
    void supabase
      .from("bonus_evaluation_notifications")
      .update({ opened_at: now, read_at: now })
      .eq("id", notification.id)
      .then(() => {}, () => {});
    onDismiss(notification.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className="pointer-events-auto w-[20rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-primary/25 bg-[linear-gradient(150deg,hsl(234_48%_11%/0.98),hsl(258_42%_13%/0.98))] shadow-2xl shadow-black/60 backdrop-blur-md"
      role="alert"
      aria-live="polite"
    >
      {/* Accent strip */}
      <div className="h-1 w-full bg-gradient-to-r from-primary/70 via-primary to-primary/50" />

      <div className="p-3.5">
        {/* Header row */}
        <div className="flex items-center gap-3">
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.08, type: "spring", stiffness: 400, damping: 18 }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 border border-primary/25 shadow-inner shadow-primary/10"
          >
            <ClipboardCheck className="h-5 w-5 text-primary" />
          </motion.div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-foreground leading-tight">Nova avaliação recebida</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground/60 truncate">
              {notification.evaluatorName ? `por ${notification.evaluatorName}` : "Sua avaliação está disponível"}
              {" · "}
              <span className="text-muted-foreground/45">{notification.period_key}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => onDismiss(notification.id)}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground/40 hover:text-foreground/70 hover:bg-white/[0.06] transition-colors"
            aria-label="Fechar notificação"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={markOpenedAndNavigate}
          className="group mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:brightness-110 active:scale-[0.98]"
        >
          Ver avaliação completa
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </motion.div>
  );
}
