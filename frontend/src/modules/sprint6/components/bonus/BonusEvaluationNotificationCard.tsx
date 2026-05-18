import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardCheck, X } from "lucide-react";
import type { BonusNotificationItem } from "@/modules/sprint6/hooks/useBonusEvaluationNotifier";
import { supabaseExt as supabase } from "@/lib/supabase";

interface Props {
  notification: BonusNotificationItem;
  onDismiss: (id: string) => void;
  /** Auto-dismiss after this many ms. Default: 30s */
  autoHideMs?: number;
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
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

  const markOpenedAndNavigate = async () => {
    onDismiss(notification.id);
    await supabase
      .from("bonus_evaluation_notifications")
      .update({
        opened_at: new Date().toISOString(),
        read_at: new Date().toISOString(),
      })
      .eq("id", notification.id);
    navigate("/admin/testes/bonificacao");
  };

  return (
    <div
      className="pointer-events-auto w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-primary/20 bg-[linear-gradient(135deg,hsl(234_45%_10%/0.97),hsl(260_40%_12%/0.97))] shadow-2xl shadow-black/60 backdrop-blur-md overflow-hidden"
      role="alert"
      aria-live="polite"
    >
      {/* Accent strip */}
      <div className="h-0.5 w-full bg-gradient-to-r from-primary/60 via-primary to-primary/40" />

      <div className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 border border-primary/20">
            <ClipboardCheck className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground leading-tight">Nova avaliação recebida</p>
            {notification.evaluatorName && (
              <p className="mt-0.5 text-[11px] text-muted-foreground/60 truncate">
                por {notification.evaluatorName}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onDismiss(notification.id)}
            className="shrink-0 rounded-lg p-1 text-muted-foreground/40 hover:text-foreground/70 hover:bg-white/[0.06] transition-colors"
            aria-label="Fechar notificação"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Details */}
        <div className="rounded-xl border border-border/10 bg-white/[0.025] px-3.5 py-2.5 space-y-1">
          <div className="flex justify-between items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/40 font-semibold">Período</span>
            <span className="text-xs font-semibold text-foreground/80">{notification.period_key}</span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/40 font-semibold">Recebida em</span>
            <span className="text-xs text-muted-foreground/60">{formatDateTime(notification.created_at)}</span>
          </div>
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={markOpenedAndNavigate}
          className="w-full rounded-xl bg-primary/12 border border-primary/25 py-2 text-xs font-semibold text-primary hover:bg-primary/18 transition-colors"
        >
          Ver avaliação completa
        </button>
      </div>
    </div>
  );
}
