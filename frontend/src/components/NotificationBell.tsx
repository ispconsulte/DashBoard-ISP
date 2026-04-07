import { useState, useRef, useEffect, memo } from "react";
import {
  Bell,
  Check,
  AlertTriangle,
  Clock,
  X,
  Sparkles,
  CalendarClock,
  UserCheck,
  Users,
  Filter,
} from "lucide-react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import type { AppNotification } from "@/hooks/useNotifications";
import { useNavigate } from "react-router-dom";

type StatusFilter = "all" | "overdue" | "in_progress";

type Props = {
  notifications: AppNotification[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  collapsed?: boolean;
};

/** Get urgency color based on days remaining */
function getDeadlineColor(daysRemaining?: number): { clockColor: string; badgeBg: string } {
  if (daysRemaining === undefined) return { clockColor: "text-muted-foreground", badgeBg: "bg-muted/30" };
  if (daysRemaining <= 1) return { clockColor: "text-red-400", badgeBg: "bg-red-500/15" };
  if (daysRemaining <= 3) return { clockColor: "text-amber-400", badgeBg: "bg-amber-500/15" };
  return { clockColor: "text-emerald-400", badgeBg: "bg-emerald-500/15" };
}

const typeConfig = {
  overdue: {
    icon: AlertTriangle,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
    dot: "bg-rose-400",
  },
  deadline_soon: {
    icon: CalendarClock,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    dot: "bg-amber-400",
  },
  new_assignment: {
    icon: Sparkles,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    dot: "bg-blue-400",
  },
  project_alert: {
    icon: AlertTriangle,
    color: "text-orange-400",
    bg: "bg-orange-500/15",
    border: "border-orange-500/30",
    dot: "bg-orange-400",
  },
  info: {
    icon: Bell,
    color: "text-white/60",
    bg: "bg-white/5",
    border: "border-white/10",
    dot: "bg-white/40",
  },
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

/** Status filter pill label */
const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "Todas",
  overdue: "Atrasadas",
  in_progress: "Em andamento",
};

/** Bell shake animation — runs every 15 seconds when there are unread notifications */
const SHAKE_INTERVAL_MS = 15_000;

function NotificationBellInner({ notifications, unreadCount, onMarkAsRead, onMarkAllAsRead, collapsed }: Props) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [onlyMine, setOnlyMine] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const bellControls = useAnimation();
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMobile = useIsMobile();

  // Lock body scroll when notification panel is open on mobile
  useEffect(() => {
    if (!open || !isMobile) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open, isMobile]);

  // Periodic bell shake when there are unread notifications
  useEffect(() => {
    if (unreadCount === 0) return;

    const shake = async () => {
      await bellControls.start({
        rotate: [0, -18, 18, -14, 14, -8, 8, 0],
        transition: { duration: 0.6, ease: "easeInOut" },
      });
    };

    // Shake immediately on mount (first time)
    shake();

    // Then shake every SHAKE_INTERVAL_MS
    shakeTimerRef.current = setInterval(shake, SHAKE_INTERVAL_MS);

    return () => {
      if (shakeTimerRef.current) clearInterval(shakeTimerRef.current);
      bellControls.stop();
    };
  }, [unreadCount, bellControls]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  /** Apply client-side filters on top of what the hook already returns */
  const filtered = notifications.filter((n) => {
    if (onlyMine && !n.isOwnTask) return false;
    if (statusFilter === "overdue" && n.type !== "overdue") return false;
    if (statusFilter === "in_progress" && n.type === "overdue") return false;
    return true;
  });

  const filteredUnread = filtered.filter((n) => !n.read).length;

  const handleNotificationClick = (notif: AppNotification) => {
    if (!notif.read) onMarkAsRead(notif.id);
    setOpen(false);
    if (notif.link) navigate(notif.link);
  };

  // Compute panel position for desktop; mobile uses fixed full-width
  const getPanelStyle = (): React.CSSProperties => {
    if (isMobile) {
      return {
        background: "linear-gradient(160deg, hsl(234 50% 13%), hsl(260 45% 10%))",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        maxWidth: "100%",
        maxHeight: "100%",
        borderRadius: 0,
      };
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const panelWidth = 380;
    let rightPos = 16;
    if (rect) {
      const rightEdge = viewportWidth - rect.right;
      rightPos = Math.max(8, rightEdge - (panelWidth / 2) + (rect.width / 2));
      // Ensure panel doesn't go off-screen right
      if (rightPos + panelWidth > viewportWidth - 8) {
        rightPos = viewportWidth - panelWidth - 8;
      }
      // Ensure panel doesn't go off-screen left
      if (rightPos < 8) rightPos = 8;
    }
    return {
      background: "linear-gradient(160deg, hsl(234 50% 13%), hsl(260 45% 10%))",
      top: rect ? rect.bottom + 8 : 0,
      right: rightPos,
    };
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
        className={`relative flex items-center justify-center rounded-xl transition-all duration-200 hover:bg-white/[0.08] h-9 w-9 ${
          open ? "bg-white/[0.1] text-white" : "text-white/50 hover:text-white/80"
        }`}
        aria-label="Notificações"
      >
        <motion.div animate={bellControls} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Bell className="h-[18px] w-[18px]" />
        </motion.div>
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-rose-600 px-1 text-[9px] font-bold text-white shadow-lg shadow-rose-500/40 tabular-nums"
            >
              {unreadCount > 99 ? "99+" : unreadCount > 9 ? "9+" : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Mobile backdrop */}
            {isMobile && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[99] bg-black/60"
                onClick={() => setOpen(false)}
              />
            )}
            <motion.div
              ref={panelRef}
              initial={isMobile ? { opacity: 0, y: "100%" } : { opacity: 0, y: -8, scale: 0.96 }}
              animate={isMobile ? { opacity: 1, y: 0 } : { opacity: 1, y: 0, scale: 1 }}
              exit={isMobile ? { opacity: 0, y: "100%" } : { opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
              className={`fixed z-[100] overflow-hidden border border-white/[0.08] shadow-2xl shadow-black/60 flex flex-col ${
                isMobile ? "inset-0" : "w-[380px] max-h-[520px] rounded-2xl"
              }`}
              style={getPanelStyle()}
            >
            {/* Header */}
            <div className={`flex items-center justify-between border-b border-white/[0.06] px-4 ${isMobile ? "py-4" : "py-3"}`}>
              <div className="flex items-center gap-2">
                <h3 className={`font-bold text-white ${isMobile ? "text-base" : "text-sm"}`}>Tarefas Pendentes</h3>
                {filteredUnread > 0 && (
                  <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-400">
                    {filteredUnread} nova{filteredUnread > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className={`flex items-center justify-center rounded-xl text-white/40 transition hover:bg-white/[0.08] hover:text-white/70 ${isMobile ? "h-10 w-10" : "h-6 w-6 rounded-lg"}`}
              >
                <X className={isMobile ? "h-5 w-5" : "h-3.5 w-3.5"} />
              </button>
            </div>

            {/* Filter bar */}
            <div className="flex items-center gap-2 border-b border-white/[0.04] px-3 py-2.5">
              {/* Status filters */}
              <div className="flex items-center gap-1 flex-1">
                <Filter className="h-3 w-3 text-white/25 shrink-0" />
                {(["all", "overdue", "in_progress"] as StatusFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all duration-150 ${
                      statusFilter === f
                        ? f === "overdue"
                          ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          : f === "in_progress"
                          ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                          : "bg-white/10 text-white border border-white/15"
                        : "text-white/30 hover:text-white/60 hover:bg-white/[0.05]"
                    }`}
                  >
                    {STATUS_LABELS[f]}
                  </button>
                ))}
              </div>

              {/* Mine-only toggle */}
              <button
                onClick={() => setOnlyMine((v) => !v)}
                title={onlyMine ? "Ver todas as tarefas" : "Ver apenas minhas tarefas"}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all duration-150 border ${
                  onlyMine
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : "text-white/30 border-white/10 hover:text-white/60 hover:bg-white/[0.05]"
                }`}
              >
                {onlyMine ? (
                  <UserCheck className="h-3 w-3" />
                ) : (
                  <Users className="h-3 w-3" />
                )}
                <span>{onlyMine ? "Minhas" : "Todos"}</span>
              </button>
            </div>

            {/* List */}
            <div className={`overflow-y-auto divide-y divide-white/[0.04] ${isMobile ? "flex-1" : "max-h-[390px]"}`}>
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04]">
                    <Bell className="h-5 w-5 text-white/20" />
                  </div>
                  <p className="text-sm font-semibold text-white/40">Nenhum resultado</p>
                  <p className="text-[11px] text-white/20 mt-1">
                    {statusFilter !== "all" || onlyMine
                      ? "Tente mudar os filtros."
                      : "Nenhuma notificação no momento."}
                  </p>
                </div>
              ) : (
                filtered.map((notif, i) => {
                  const config = typeConfig[notif.type];
                  const Icon = config.icon;
                  const deadlineColors = getDeadlineColor(notif.daysRemaining);
                  return (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.2 }}
                      onClick={() => handleNotificationClick(notif)}
                      className={`group flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer ${
                        notif.read
                          ? "opacity-50 hover:opacity-70"
                          : "hover:bg-white/[0.04]"
                      } ${notif.isOwnTask ? "border-l-2 border-l-primary/40" : ""}`}
                    >
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${config.bg} border ${config.border}`}>
                        <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[12px] font-semibold text-white/80 truncate">{notif.title}</p>
                          {!notif.read && (
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${config.dot}`} />
                          )}
                          {/* "Minha tarefa" badge */}
                          {notif.isOwnTask && (
                            <span className="shrink-0 flex items-center gap-0.5 rounded-md bg-emerald-500/15 px-1 py-0.5">
                              <UserCheck className="h-2.5 w-2.5 text-emerald-400" />
                              <span className="text-[9px] font-bold text-emerald-400">Minha</span>
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-white/40 mt-0.5 line-clamp-2">{notif.message}</p>
                        {/* Deadline date with color-coded clock */}
                        {notif.deadlineDateStr && (
                          <div className={`inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-md ${deadlineColors.badgeBg}`}>
                            <Clock className={`h-2.5 w-2.5 ${deadlineColors.clockColor}`} />
                            <span className={`text-[10px] font-semibold ${deadlineColors.clockColor}`}>
                              {notif.deadlineDateStr}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          {notif.projectName && (
                            <span className="text-[9px] font-semibold text-white/25 uppercase tracking-wider truncate max-w-[150px]">
                              {notif.projectName}
                            </span>
                          )}
                          <span className="text-[9px] text-white/20">{timeAgo(notif.timestamp)}</span>
                        </div>
                      </div>
                      {!notif.read && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onMarkAsRead(notif.id); }}
                          className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-white/20 opacity-0 transition-all group-hover:opacity-100 hover:bg-white/[0.08] hover:text-white/50"
                          title="Marcar como lida"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                      )}
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default memo(NotificationBellInner);
