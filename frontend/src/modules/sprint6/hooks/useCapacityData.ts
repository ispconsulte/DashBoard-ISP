// ── Sprint 6.0 — Capacity data hook ────────────────────────────────
// Reads elapsed_times + tasks for project load & top consultants.
// Reads user_capacity for available hours and utilization %.
// Reads users for department & seniority filters.

import { useEffect, useMemo, useState } from "react";
import { supabaseExt as supabase } from "@/lib/supabase";
import { useElapsedTimes } from "@/modules/tasks/api/useElapsedTimes";
import { useTasks } from "@/modules/tasks/api/useTasks";
import { getElapsedEffectiveDate } from "@/modules/tasks/utils";
import type { RoiPeriod, SeniorityLevel } from "@/modules/sprint6/types";

// ── Types ───────────────────────────────────────────────────────────

export interface CapacityProjectLoadItem {
  projectId: number;
  projectName: string;
  totalHours: number;
  percentOfTotal: number;
}

export interface CapacityConsultantItem {
  name: string;
  userId: string | number | null;
  totalHours: number;
  taskCount: number;
  availableHours: number | null;
  utilizationPercent: number | null;
  isOverloaded: boolean;
  department: string | null;
  seniority: string | null;
}

export interface CapacityDataResult {
  projectLoad: CapacityProjectLoadItem[];
  topConsultants: CapacityConsultantItem[];
  totalHours: number;
  totalAvailableHours: number;
  averageUtilization: number | null;
  consultantsTracked: number;
  seniorityDistribution: { level: string; hours: number; consultants: number }[];
  loading: boolean;
  error: string | null;
  missingDependencies: string[];
  /** Distinct departments for filter */
  departments: string[];
  /** Whether seniority data exists */
  hasSeniority: boolean;
  /** Overloaded consultants (utilization > 100%) */
  overloadedCount: number;
}

export interface UseCapacityDataOptions {
  accessToken?: string;
  period?: RoiPeriod;
  department?: string | null;
  seniorityLevel?: SeniorityLevel | null;
}

// ── Hook ────────────────────────────────────────────────────────────

export function useCapacityData(opts: UseCapacityDataOptions = {}): CapacityDataResult {
  const { accessToken, period = "180d", department, seniorityLevel } = opts;

  const elapsed = useElapsedTimes({ accessToken, period });
  const { tasks, loading: tasksLoading, error: tasksError } = useTasks({ accessToken, period });

  // Load user_capacity and users from Lovable Cloud
  const [capacityMap, setCapacityMap] = useState<Record<string, number>>({});
  const [userMeta, setUserMeta] = useState<
    { id: string; name: string; department: string | null; seniority_level: string | null }[]
  >([]);
  const [cloudLoading, setCloudLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!accessToken) {
        setCapacityMap({});
        setUserMeta([]);
        setCloudLoading(false);
        return;
      }
      setCloudLoading(true);
      try {
        // Current month for capacity lookup
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

        const [capRes, usersRes] = await Promise.all([
          supabase.from("user_capacity").select("user_id, available_hours, month").eq("month", currentMonth),
          supabase.from("users").select("id, name, department, seniority_level").eq("active", true),
        ]);

        if (cancelled) return;

        const map: Record<string, number> = {};
        (capRes.data ?? []).forEach((r: any) => { map[r.user_id] = Number(r.available_hours); });
        setCapacityMap(map);
        setUserMeta((usersRes.data as any) ?? []);
      } catch {
        // Non-critical — we just won't show utilization
      } finally {
        if (!cancelled) setCloudLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [accessToken]);

  // User meta maps
  const userMetaMap = useMemo(() => {
    const map = new Map<string, { name: string; department: string | null; seniority: string | null }>();
    for (const u of userMeta) {
      map.set(u.id, { name: u.name, department: u.department, seniority: u.seniority_level });
    }
    return map;
  }, [userMeta]);

  // Derive departments list
  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const u of userMeta) {
      if (u.department) set.add(u.department);
    }
    return Array.from(set).sort();
  }, [userMeta]);

  const hasSeniority = useMemo(() => userMeta.some((u) => !!u.seniority_level), [userMeta]);

  // Build task_id → info map
  const taskMap = useMemo(() => {
    const map = new Map<string | number, {
      projectId: number;
      projectName: string;
      consultantName: string;
      userId: string | number | null;
    }>();
    for (const t of tasks) {
      const id = t.task_id ?? t.id;
      if (!id) continue;
      const projectName = String(t.project_name ?? t.project ?? t.projeto ?? t.group_name ?? "Sem projeto").trim();
      const projectId = Number(t.project_id) || 0;
      const consultantName = String(t.responsible_name ?? t.consultant ?? t.responsavel ?? "").trim();
      const userId = t.user_id ?? null;
      map.set(id, { projectId, projectName, consultantName, userId });
    }
    return map;
  }, [tasks]);

  // Aggregate hours by project
  const projectLoad = useMemo<CapacityProjectLoadItem[]>(() => {
    if (!elapsed.times.length) return [];

    const byProject = new Map<number, { name: string; hours: number }>();
    let total = 0;

    for (const t of elapsed.times) {
      const hours = (Number(t.seconds) || 0) / 3600;
      if (hours <= 0) continue;

      const taskInfo = taskMap.get(t.task_id ?? "");

      // Apply department/seniority filter
      if (department || seniorityLevel) {
        const userId = taskInfo?.userId ?? t.user_id;
        if (userId) {
          const meta = userMetaMap.get(String(userId));
          if (department && meta?.department !== department) continue;
          if (seniorityLevel && meta?.seniority !== seniorityLevel) continue;
        }
      }

      total += hours;
      const projectId = taskInfo?.projectId ?? 0;
      const projectName = taskInfo?.projectName ?? "Sem projeto";
      const existing = byProject.get(projectId) ?? { name: projectName, hours: 0 };
      existing.hours += hours;
      byProject.set(projectId, existing);
    }

    if (total === 0) return [];

    return Array.from(byProject.entries())
      .map(([projectId, { name, hours }]) => ({
        projectId,
        projectName: name,
        totalHours: Math.round(hours * 10) / 10,
        percentOfTotal: Math.round((hours / total) * 1000) / 10,
      }))
      .sort((a, b) => b.totalHours - a.totalHours);
  }, [elapsed.times, taskMap, department, seniorityLevel, userMetaMap]);

  // Aggregate hours by consultant + utilization
  const topConsultants = useMemo<CapacityConsultantItem[]>(() => {
    if (!elapsed.times.length) return [];

    const byConsultant = new Map<string, {
      userId: string | number | null;
      hours: number;
      tasks: Set<string | number>;
    }>();

    for (const t of elapsed.times) {
      const hours = (Number(t.seconds) || 0) / 3600;
      if (hours <= 0) continue;

      const taskInfo = taskMap.get(t.task_id ?? "");
      const name = taskInfo?.consultantName || "Desconhecido";
      const userId = taskInfo?.userId ?? t.user_id ?? null;

      // Apply department/seniority filter
      if (department || seniorityLevel) {
        if (userId) {
          const meta = userMetaMap.get(String(userId));
          if (department && meta?.department !== department) continue;
          if (seniorityLevel && meta?.seniority !== seniorityLevel) continue;
        }
      }

      const existing = byConsultant.get(name) ?? { userId, hours: 0, tasks: new Set() };
      existing.hours += hours;
      if (t.task_id) existing.tasks.add(t.task_id);
      byConsultant.set(name, existing);
    }

    return Array.from(byConsultant.entries())
      .map(([name, { userId, hours, tasks: taskSet }]) => {
        const available = userId ? capacityMap[String(userId)] ?? null : null;
        const utilization = available != null && available > 0
          ? Math.round((hours / available) * 1000) / 10
          : null;
        const meta = userId ? userMetaMap.get(String(userId)) : null;

        return {
          name,
          userId,
          totalHours: Math.round(hours * 10) / 10,
          taskCount: taskSet.size,
          availableHours: available,
          utilizationPercent: utilization,
          isOverloaded: utilization != null && utilization > 100,
          department: meta?.department ?? null,
          seniority: meta?.seniority ?? null,
        };
      })
      .sort((a, b) => b.totalHours - a.totalHours);
  }, [elapsed.times, taskMap, capacityMap, userMetaMap, department, seniorityLevel]);

  const totalHours = useMemo(
    () => projectLoad.reduce((sum, p) => sum + p.totalHours, 0),
    [projectLoad],
  );

  const overloadedCount = useMemo(
    () => topConsultants.filter((c) => c.isOverloaded).length,
    [topConsultants],
  );

  const totalAvailableHours = useMemo(
    () =>
      topConsultants.reduce((sum, consultant) => {
        if (consultant.availableHours == null) return sum;
        return sum + consultant.availableHours;
      }, 0),
    [topConsultants],
  );

  const averageUtilization = useMemo(() => {
    const consultantsWithCapacity = topConsultants.filter((consultant) => consultant.utilizationPercent != null);
    if (!consultantsWithCapacity.length) return null;
    return Math.round(
      (consultantsWithCapacity.reduce((sum, consultant) => sum + (consultant.utilizationPercent ?? 0), 0) /
        consultantsWithCapacity.length) * 10,
    ) / 10;
  }, [topConsultants]);

  const seniorityDistribution = useMemo(() => {
    const byLevel = new Map<string, { hours: number; consultants: Set<string> }>();
    for (const consultant of topConsultants) {
      const level = consultant.seniority || "Nao definido";
      const entry = byLevel.get(level) ?? { hours: 0, consultants: new Set<string>() };
      entry.hours += consultant.totalHours;
      entry.consultants.add(consultant.name);
      byLevel.set(level, entry);
    }

    return Array.from(byLevel.entries())
      .map(([level, entry]) => ({
        level,
        hours: Math.round(entry.hours * 10) / 10,
        consultants: entry.consultants.size,
      }))
      .sort((a, b) => b.hours - a.hours);
  }, [topConsultants]);

  return {
    projectLoad,
    topConsultants,
    totalHours,
    totalAvailableHours,
    averageUtilization,
    consultantsTracked: topConsultants.length,
    seniorityDistribution,
    loading: elapsed.loading || tasksLoading || cloudLoading,
    error: elapsed.error || tasksError,
    departments,
    hasSeniority,
    overloadedCount,
    missingDependencies: [
      "A disponibilidade real depende de user_capacity preenchido para o mês atual.",
      "Filtros operacionais mais ricos dependem de users.department e users.seniority_level populados.",
    ],
  };
}
