import { useMemo, useState, useCallback } from "react";
import type { TaskRecord } from "@/modules/tasks/types";
import type { ProjectHours } from "@/modules/tasks/api/useProjectHours";
import type { ElapsedTimeRecord } from "@/modules/tasks/types";
import type { ProjectAnalytics } from "../types";
import { storage } from "@/modules/shared/storage";

export function classifyTask(task: TaskRecord): "done" | "overdue" | "pending" {
  const status = String(task.status ?? task.situacao ?? "").toLowerCase();
  if (["5", "done", "concluida", "concluído", "finalizada", "completed"].some((s) => status.includes(s)))
    return "done";
  const deadline = task.deadline ?? task.due_date ?? task.dueDate ?? task.data;
  if (deadline) {
    const d = new Date(String(deadline));
    if (!Number.isNaN(d.getTime()) && d < new Date()) return "overdue";
  }
  return "pending";
}

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function isResponsibleMatch(taskResponsible: string, userName: string): boolean {
  const a = normalize(taskResponsible);
  const b = normalize(userName);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const aParts = a.split(/\s+/);
  const bParts = b.split(/\s+/);
  if (aParts.length >= 2 && bParts.length >= 2) {
    if (aParts[0] === bParts[0] && aParts[aParts.length - 1] === bParts[bParts.length - 1]) return true;
  }
  return false;
}

export function useAnalyticsData(
  allTasks: TaskRecord[],
  projectHours: ProjectHours[],
  allTimes: ElapsedTimeRecord[],
  userName?: string
) {
  const [favorites, setFavorites] = useState<Set<number>>(() => {
    try {
      const stored = storage.get<number[] | null>("ana:favorites", null);
      return Array.isArray(stored) ? new Set(stored) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleFavorite = useCallback((projectId: number) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      storage.set("ana:favorites", [...next]);
      return next;
    });
  }, []);

  // Filter tasks by user
  const { tasks, isFiltered } = useMemo(() => {
    if (!userName) return { tasks: allTasks, isFiltered: false };
    const filtered = allTasks.filter((t) => {
      const responsible = String(t.responsible_name ?? t.responsavel ?? t.consultant ?? t.owner ?? "");
      return isResponsibleMatch(responsible, userName);
    });
    return { tasks: filtered, isFiltered: true };
  }, [allTasks, userName]);

  // Get task IDs from user's tasks for filtering elapsed_times
  const userTaskIds = useMemo(() => {
    const ids = new Set<string | number>();
    tasks.forEach((t) => {
      const tid = t.task_id ?? t.id;
      if (tid) ids.add(tid);
    });
    return ids;
  }, [tasks]);

  // Filter elapsed_times to only user's tasks
  const userTimes = useMemo(() => {
    if (!isFiltered) return allTimes;
    return allTimes.filter((t) => {
      const tid = t.task_id;
      return tid && userTaskIds.has(tid);
    });
  }, [allTimes, userTaskIds, isFiltered]);

  // Get project IDs from user's tasks
  const userProjectIds = useMemo(() => {
    const ids = new Set<number>();
    tasks.forEach((t) => {
      const pid = Number(t.project_id);
      if (pid) ids.add(pid);
    });
    return ids;
  }, [tasks]);

  // Filter project hours to only user's projects
  const filteredProjectHours = useMemo(() => {
    if (!userName || !isFiltered) return projectHours;
    return projectHours.filter((ph) => userProjectIds.has(ph.projectId));
  }, [projectHours, userProjectIds, userName, isFiltered]);

  const tasksByProject = useMemo(() => {
    const map = new Map<number, { done: number; pending: number; overdue: number }>();
    tasks.forEach((t) => {
      const pid = Number(t.project_id);
      if (!pid) return;
      if (!map.has(pid)) map.set(pid, { done: 0, pending: 0, overdue: 0 });
      const entry = map.get(pid)!;
      entry[classifyTask(t)]++;
    });
    return map;
  }, [tasks]);

  const projects: ProjectAnalytics[] = useMemo(() => {
    /** Sanitiza o nome do cliente: remove placeholders como [NOME DO CLIENTE] */
    const sanitizeClientName = (raw: string | null | undefined): string => {
      if (!raw) return "";
      const s = raw.trim();
      if (s.length < 2) return "";
      if (/^\[.*\]$/.test(s)) return "";
      const lower = s.toLowerCase();
      if (
        lower.includes("nome do cliente") ||
        lower.startsWith("[nome") ||
        lower === "cliente" ||
        lower === "sem cliente" ||
        lower === "n/a" ||
        lower === "-"
      ) return "";
      return s;
    };

    const fromHours = filteredProjectHours.map((ph) => {
      const taskStats = tasksByProject.get(ph.projectId) ?? { done: 0, pending: 0, overdue: 0 };
      const totalTasks = taskStats.done + taskStats.pending + taskStats.overdue;
      const completionRate = totalTasks > 0 ? taskStats.done / totalTasks : 0;
      const overdueRate = totalTasks > 0 ? taskStats.overdue / totalTasks : 0;
      const performance: "good" | "neutral" | "bad" =
        overdueRate > 0.3 ? "bad" : completionRate > 0.6 ? "good" : "neutral";

      return {
        projectId: ph.projectId,
        projectName: ph.projectName,
        clientId: ph.clientId,
        clientName: sanitizeClientName(ph.clientName),
        hoursUsed: ph.hours,
        hoursContracted: 0,
        isActive: taskStats.pending > 0 || taskStats.overdue > 0,
        isFavorite: favorites.has(ph.projectId),
        tasksDone: taskStats.done,
        tasksPending: taskStats.pending,
        tasksOverdue: taskStats.overdue,
        performance,
      };
    });

    // Build a lookup: clientId → clientName from projects that DO have a real clientName
    const clientNameById = new Map<number, string>();
    fromHours.forEach((p) => {
      if (p.clientId && p.clientName) {
        clientNameById.set(p.clientId, p.clientName);
      }
    });

    const existingIds = new Set(fromHours.map((p) => p.projectId));
    const fromTasks: ProjectAnalytics[] = [];
    tasksByProject.forEach((stats, pid) => {
      if (existingIds.has(pid)) return;
      const task = tasks.find((t) => Number(t.project_id) === pid);
      const joinName = task?.projects && typeof task.projects === "object"
        ? String((task.projects as any).name ?? "").trim()
        : "";
      const projectName = joinName || (task?.project_name ?? task?.project ?? task?.projeto ?? `Projeto ${pid}`);
      const clientId = Number(task?.projects?.cliente_id ?? 0);
      const clientName = clientId ? sanitizeClientName(clientNameById.get(clientId) ?? "") : "";
      const totalTasks = stats.done + stats.pending + stats.overdue;
      const completionRate = totalTasks > 0 ? stats.done / totalTasks : 0;
      const overdueRate = totalTasks > 0 ? stats.overdue / totalTasks : 0;
      const performance: "good" | "neutral" | "bad" =
        overdueRate > 0.3 ? "bad" : completionRate > 0.6 ? "good" : "neutral";

      fromTasks.push({
        projectId: pid,
        projectName: String(projectName),
        clientId,
        clientName,
        hoursUsed: 0,
        hoursContracted: 0,
        isActive: stats.pending > 0 || stats.overdue > 0,
        isFavorite: favorites.has(pid),
        tasksDone: stats.done,
        tasksPending: stats.pending,
        tasksOverdue: stats.overdue,
        performance,
      });
    });

    return [...fromHours, ...fromTasks];
  }, [filteredProjectHours, tasksByProject, favorites, tasks]);

  const uniqueClients = useMemo(() => {
    const set = new Set<number>();
    projects.forEach((p) => {
      if (p.clientId) set.add(p.clientId);
    });
    return set.size;
  }, [projects]);

  const totalDone = useMemo(() => tasks.filter((t) => classifyTask(t) === "done").length, [tasks]);
  const totalPending = useMemo(() => tasks.filter((t) => classifyTask(t) === "pending").length, [tasks]);
  const totalOverdue = useMemo(() => tasks.filter((t) => classifyTask(t) === "overdue").length, [tasks]);
  const totalHours = useMemo(() => filteredProjectHours.reduce((s, p) => s + p.hours, 0), [filteredProjectHours]);
  const userTaskCount = tasks.length;

  return {
    projects,
    uniqueClients,
    totalDone,
    totalPending,
    totalOverdue,
    totalHours,
    toggleFavorite,
    userTaskCount,
    userTimes,
    userTasks: tasks,
  };
}
