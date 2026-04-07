import { useEffect, useRef, useState, useCallback } from "react";
import { storage } from "@/modules/shared/storage";

type TaskStatusEntry = { id: string | number; status: string; title: string; project: string };

export type StatusAlert = {
  message: string;
  count: number;
  timestamp: number;
};

/**
 * Detects tasks that became overdue since the last check.
 * Returns alerts to be consumed by the AssistantReminder widget.
 * userId is used to namespace localStorage and prevent cross-user data leakage.
 */
export function useTaskStatusAlerts(
  tasks: TaskStatusEntry[],
  enabled: boolean = true,
  userId?: string,
  userRole?: string,
) {
  const initialLoad = useRef(true);
  const [alert, setAlert] = useState<StatusAlert | null>(null);
  const storageKey = userId ? `task_status_snapshot_${userId}` : "task_status_snapshot";

  const dismissAlert = useCallback(() => setAlert(null), []);

  // Reset on user change
  useEffect(() => {
    initialLoad.current = true;
    setAlert(null);
  }, [userId]);

  useEffect(() => {
    if (!enabled || tasks.length === 0 || !userId) return;

    const prevSnapshot = storage.get<Record<string, string>>(storageKey, {});
    const currentSnapshot: Record<string, string> = {};

    const newlyOverdue: TaskStatusEntry[] = [];
    const alreadyOverdue: TaskStatusEntry[] = [];

    tasks.forEach((t) => {
      const key = String(t.id);
      currentSnapshot[key] = t.status;

      if (t.status === "overdue") {
        if (initialLoad.current) {
          // First load: collect all overdue tasks
          alreadyOverdue.push(t);
        } else if (prevSnapshot[key] && prevSnapshot[key] !== "overdue") {
          // Subsequent updates: only newly transitioned
          newlyOverdue.push(t);
        }
      }
    });

    storage.set(storageKey, currentSnapshot);

    const isFirstLoad = initialLoad.current;
    if (isFirstLoad) {
      initialLoad.current = false;
    }

    // On first load show alert for existing overdue tasks
    // On subsequent updates show alert for newly overdue tasks
    const alertTasks = isFirstLoad ? alreadyOverdue : newlyOverdue;

    if (alertTasks.length > 0) {
      const isAdmin = userRole === "admin" || userRole === "gerente" || userRole === "coordenador";
      const count = alertTasks.length;

      const message = isAdmin
        ? `⚠️ Existem ${count} tarefa(s) em atraso nos projetos.\n\nVerifique-as clicando no botão abaixo. Lembre-se: somos um time! Em caso de dificuldade, mobilize a equipe. Juntos vamos crescer! 💪`
        : `⚠️ Você possui ${count} tarefa(s) em atraso.\n\nConfira suas tarefas para não perder os prazos! Mantenha o foco e, sempre que precisar, solicite apoio ao seu time. Juntos vamos crescer! 💪`;

      setAlert({
        message,
        count,
        timestamp: Date.now(),
      });
    }
  }, [tasks, enabled, userId, userRole, storageKey]);

  return { alert, dismissAlert };
}
