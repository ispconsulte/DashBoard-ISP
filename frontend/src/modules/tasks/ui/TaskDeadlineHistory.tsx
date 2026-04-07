import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { History, CalendarClock, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type DeadlineChange = {
  id: string;
  task_id: number;
  previous_deadline: string | null;
  new_deadline: string | null;
  changed_by: string | null;
  change_description: string;
  detected_at: string;
};

function isMissingDeadlineChangesRelation(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  if (error.code === "PGRST205" || error.code === "42P01") return true;
  const message = String(error.message ?? "").toLowerCase();
  return message.includes("task_deadline_changes") && (
    message.includes("not found") ||
    message.includes("does not exist") ||
    message.includes("could not find")
  );
}

function formatDateTimePtBR(iso: string | null): string {
  if (!iso) return "sem prazo";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "data inválida";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} às ${hours}:${mins}`;
}

function formatDatePtBRShort(iso: string | null): string {
  if (!iso) return "sem prazo";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function TaskDeadlineHistory({ taskId }: { taskId: number | string }) {
  const [changes, setChanges] = useState<DeadlineChange[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("task_deadline_changes")
        .select("id, task_id, previous_deadline, new_deadline, changed_by, change_description, detected_at")
        .eq("task_id", Number(taskId))
        .order("detected_at", { ascending: false })
        .limit(20);

      if (!cancelled) {
        if (error && isMissingDeadlineChangesRelation(error)) {
          setChanges([]);
        } else if (!error && data) {
          setChanges(data as DeadlineChange[]);
        }
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [taskId]);

  if (loading) {
    return (
      <div className="rounded-lg border border-[hsl(var(--task-border))] bg-[hsl(var(--task-surface))] p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <History className="h-3 w-3 text-[hsl(var(--task-purple))]" />
          <span className="text-[9px] uppercase tracking-wider text-[hsl(var(--task-text-muted))]">Histórico de alterações</span>
        </div>
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-10 rounded-lg bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (changes.length === 0) return null;

  return (
    <div className="rounded-lg border border-[hsl(var(--task-border))] bg-[hsl(var(--task-surface))] overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-2.5">
        <History className="h-3 w-3 text-[hsl(var(--task-purple))]" />
        <span className="text-[9px] uppercase tracking-wider text-[hsl(var(--task-text-muted))]">
          Histórico de alterações
        </span>
        <span className="ml-auto text-[9px] font-bold text-[hsl(var(--task-text-muted)/0.5)] tabular-nums">
          {changes.length}
        </span>
      </div>

      <div className="px-3 pb-3">
        <div className="relative space-y-0">
          {/* Timeline line */}
          {changes.length > 1 && (
            <div
              className="absolute left-[7px] top-3 bottom-3 w-px bg-[hsl(var(--task-border))]"
              aria-hidden="true"
            />
          )}

          {changes.map((change, idx) => (
            <motion.div
              key={change.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.2 }}
              className="relative flex gap-3 py-2"
            >
              {/* Timeline dot */}
              <div className="relative z-10 mt-1.5 flex h-[15px] w-[15px] shrink-0 items-center justify-center">
                <span className="h-2 w-2 rounded-full bg-[hsl(var(--task-purple))]" />
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <CalendarClock className="h-3 w-3 shrink-0 text-[hsl(var(--task-yellow))]" />
                  <span className="text-[11px] font-semibold text-[hsl(var(--task-text))]">
                    Prazo alterado
                  </span>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
                  <span className="rounded bg-rose-500/10 border border-rose-500/15 px-1.5 py-0.5 font-medium text-rose-300">
                    {formatDatePtBRShort(change.previous_deadline)}
                  </span>
                  <ArrowRight className="h-2.5 w-2.5 text-[hsl(var(--task-text-muted)/0.4)]" />
                  <span className="rounded bg-emerald-500/10 border border-emerald-500/15 px-1.5 py-0.5 font-medium text-emerald-300">
                    {formatDatePtBRShort(change.new_deadline)}
                  </span>
                </div>

                <p className="mt-1 text-[9px] text-[hsl(var(--task-text-muted)/0.5)]">
                  Alterado em {formatDateTimePtBR(change.detected_at)}
                  {change.changed_by && change.changed_by !== "sync-bitrix" && (
                    <> · Por <span className="font-medium text-[hsl(var(--task-text-muted))]">{change.changed_by}</span></>
                  )}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
