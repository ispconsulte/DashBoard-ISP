import { createContext, useContext } from "react";
import type { TaskRecord } from "@/modules/tasks/types";

/**
 * Shared tasks context — provides the 180d task dataset fetched once
 * in DashboardLayout so child pages can reuse it without duplicate fetches.
 */
export type SharedTasksData = {
  tasks: TaskRecord[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  lastUpdated: number | null;
  reloadCooldownMsLeft: number;
  reloadsRemainingThisMinute: number;
  noChanges: boolean;
  totalCount: number | null;
};

const SharedTasksContext = createContext<SharedTasksData | null>(null);

export const SharedTasksProvider = SharedTasksContext.Provider;

/**
 * Hook to consume the shared 180d tasks from DashboardLayout.
 * Returns null if called outside the provider (e.g. login page).
 */
export function useSharedTasks(): SharedTasksData | null {
  return useContext(SharedTasksContext);
}
