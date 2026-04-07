// ── Sprint 6.0 — ROI data hook ──────────────────────────────────────
// Combines project hours, contracted hours, elapsed times, and project financials.
// Calculates ROI % when financial data is available.

import { useMemo } from "react";
import { useProjectHours, type ProjectHours } from "@/modules/tasks/api/useProjectHours";
import { useContractedHours } from "@/modules/analytics/hooks/useContractedHours";
import { useElapsedTimes } from "@/modules/tasks/api/useElapsedTimes";
import { useProjectFinancials } from "@/modules/sprint6/hooks/useProjectFinancials";
import {
  type RoiSummary,
  type RoiProjectData,
  type RoiMonthlyTrend,
  type RoiPeriod,
  resolvePeriod,
  calcVariance,
} from "@/modules/sprint6/types";
import { getElapsedEffectiveDate } from "@/modules/tasks/utils";

export interface UseRoiDataOptions {
  accessToken?: string;
  period?: RoiPeriod;
  projectId?: number | null;
}

export interface UseRoiDataReturn {
  summary: RoiSummary | null;
  filteredProjects: RoiProjectData[];
  projectOptions: { id: number; name: string }[];
  monthlyTrend: RoiMonthlyTrend[];
  loading: boolean;
  error: string | null;
  /** Whether any project has financial data */
  hasFinancials: boolean;
  avgRoi: number | null;
  overBudgetProjects: number;
  projectsWithoutContractedHours: number;
  projectsWithoutFinancialData: number;
}

// ROI % = (receita - custo_total) / custo_total * 100
function calcRoi(receita: number, custoTotal: number): number | null {
  if (custoTotal <= 0) return null;
  return Math.round(((receita - custoTotal) / custoTotal) * 1000) / 10;
}

export function useRoiData(opts: UseRoiDataOptions = {}): UseRoiDataReturn {
  const { accessToken, period = "180d", projectId = null } = opts;

  const { startIso, endIso } = useMemo(() => resolvePeriod(period), [period]);

  const projectHours = useProjectHours({ startIso, endIso, projectId: null });
  const contracted = useContractedHours();
  const elapsed = useElapsedTimes({ accessToken, period });
  const financials = useProjectFinancials(accessToken);

  const hasFinancials = useMemo(() => financials.data.size > 0, [financials.data]);

  const summary = useMemo<RoiSummary | null>(() => {
    if (projectHours.loading || contracted.loading) return null;
    if (projectHours.data.length === 0 && contracted.data.size === 0) return null;

    let totalContracted = 0;
    let totalUsed = 0;
    const projectMap = new Map<number, RoiProjectData>();

    projectHours.data.forEach((ph: ProjectHours) => {
      const cRecord = contracted.data.get(ph.projectId);
      const hrsContracted = cRecord?.contracted_hours ?? 0;
      const hrsUsed = ph.hours;
      totalContracted += hrsContracted;
      totalUsed += hrsUsed;

      // Calculate ROI % if financial data exists
      const fin = financials.data.get(ph.projectId);
      let roiPercent: number | null = null;
      if (fin) {
        const custoReal = fin.custo_hora > 0 ? fin.custo_hora * hrsUsed : fin.custo_total_estimado;
        roiPercent = calcRoi(fin.receita_projeto, custoReal);
      }

      projectMap.set(ph.projectId, {
        projectId: ph.projectId,
        projectName: ph.projectName,
        hoursContracted: hrsContracted,
        hoursUsed: hrsUsed,
        variancePercent: calcVariance(hrsUsed, hrsContracted),
        roiPercent,
      });
    });

    contracted.data.forEach((cRecord, pid) => {
      if (projectMap.has(pid)) return;
      const hrs = cRecord.contracted_hours ?? 0;
      totalContracted += hrs;

      const fin = financials.data.get(pid);
      let roiPercent: number | null = null;
      if (fin && fin.custo_total_estimado > 0) {
        roiPercent = calcRoi(fin.receita_projeto, fin.custo_total_estimado);
      }

      projectMap.set(pid, {
        projectId: pid,
        projectName: `Projeto ${pid}`,
        hoursContracted: hrs,
        hoursUsed: 0,
        variancePercent: hrs > 0 ? -100 : 0,
        roiPercent,
      });
    });

    return {
      totalContracted,
      totalUsed,
      overallVariance: calcVariance(totalUsed, totalContracted),
      projects: Array.from(projectMap.values()).sort((a, b) =>
        a.projectName.localeCompare(b.projectName)
      ),
    };
  }, [projectHours.data, projectHours.loading, contracted.data, contracted.loading, financials.data]);

  const filteredProjects = useMemo<RoiProjectData[]>(() => {
    if (!summary) return [];
    if (!projectId) return summary.projects;
    return summary.projects.filter((p) => p.projectId === projectId);
  }, [summary, projectId]);

  const projectOptions = useMemo(
    () => (summary?.projects ?? []).map((p) => ({ id: p.projectId, name: p.projectName })),
    [summary],
  );

  const monthlyTrend = useMemo<RoiMonthlyTrend[]>(() => {
    if (!elapsed.times.length) return [];
    const byMonth = new Map<string, number>();
    for (const t of elapsed.times) {
      const effective = getElapsedEffectiveDate(t);
      if (!effective) continue;
      const month = `${effective.getFullYear()}-${String(effective.getMonth() + 1).padStart(2, "0")}`;
      const hours = (Number(t.seconds) || 0) / 3600;
      byMonth.set(month, (byMonth.get(month) ?? 0) + hours);
    }
    return Array.from(byMonth.entries())
      .map(([month, hoursUsed]) => ({ month, hoursUsed: Math.round(hoursUsed * 10) / 10 }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [elapsed.times]);

  const loading = projectHours.loading || contracted.loading || elapsed.loading || financials.loading;
  const error = projectHours.error || elapsed.error || financials.error || null;
  const avgRoi = useMemo(() => {
    if (!summary) return null;
    const roiProjects = summary.projects.filter((project) => project.roiPercent != null);
    if (!roiProjects.length) return null;
    return Math.round(
      (roiProjects.reduce((acc, project) => acc + (project.roiPercent ?? 0), 0) / roiProjects.length) * 10,
    ) / 10;
  }, [summary]);

  const overBudgetProjects = useMemo(
    () => (summary?.projects.filter((project) => project.variancePercent > 10).length ?? 0),
    [summary],
  );

  const projectsWithoutContractedHours = useMemo(
    () => (summary?.projects.filter((project) => project.hoursContracted <= 0).length ?? 0),
    [summary],
  );

  const projectsWithoutFinancialData = useMemo(
    () => (summary?.projects.filter((project) => project.roiPercent == null).length ?? 0),
    [summary],
  );

  return {
    summary,
    filteredProjects,
    projectOptions,
    monthlyTrend,
    loading,
    error,
    hasFinancials,
    avgRoi,
    overBudgetProjects,
    projectsWithoutContractedHours,
    projectsWithoutFinancialData,
  };
}
