import { useMemo } from "react";
import { useCapacityData } from "@/modules/sprint6/hooks/useCapacityData";
import { useClientHealthData } from "@/modules/sprint6/hooks/useClientHealthData";
import { useRoiData } from "@/modules/sprint6/hooks/useRoiData";
import type {
  RoiPeriod,
  Sprint6DataCoverageItem,
  Sprint6ExecutiveAlert,
  Sprint6ExecutiveSummary,
} from "@/modules/sprint6/types";

interface UseSprint6InsightsOptions {
  accessToken?: string;
  period?: RoiPeriod;
}

export function useSprint6Insights({ accessToken, period = "180d" }: UseSprint6InsightsOptions = {}) {
  const roi = useRoiData({ accessToken, period });
  const capacity = useCapacityData({ accessToken, period });
  const health = useClientHealthData({ accessToken });

  const summary = useMemo<Sprint6ExecutiveSummary>(() => {
    const healthScores = health.summary?.clients
      .map((client) => client.healthScore)
      .filter((score): score is number => score != null) ?? [];

    const averageHealthScore = healthScores.length
      ? Math.round((healthScores.reduce((sum, score) => sum + score, 0) / healthScores.length) * 10) / 10
      : null;

    return {
      totalProjects: roi.summary?.projects.length ?? 0,
      totalClients: health.summary?.clients.length ?? 0,
      totalTrackedHours: Math.round(roi.summary?.totalUsed ?? capacity.totalHours ?? 0),
      roiAverage: roi.avgRoi,
      averageUtilization: capacity.averageUtilization,
      averageHealthScore,
      overloadedConsultants: capacity.overloadedCount,
      atRiskClients: health.atRiskClients.length,
      overBudgetProjects: roi.overBudgetProjects,
    };
  }, [
    capacity.averageUtilization,
    capacity.overloadedCount,
    capacity.totalHours,
    health.atRiskClients.length,
    health.summary?.clients,
    roi.avgRoi,
    roi.overBudgetProjects,
    roi.summary?.projects.length,
    roi.summary?.totalUsed,
  ]);

  const alerts = useMemo<Sprint6ExecutiveAlert[]>(() => {
    const nextAlerts: Sprint6ExecutiveAlert[] = [];

    const overloaded = capacity.topConsultants
      .filter((consultant) => consultant.isOverloaded)
      .slice(0, 2);
    overloaded.forEach((consultant) => {
      nextAlerts.push({
        id: `capacity-${consultant.name}`,
        title: `${consultant.name} com sobrecarga`,
        description: `${consultant.utilizationPercent}% de utilizacao sobre ${consultant.availableHours ?? 0}h disponiveis.`,
        severity: "critical",
        route: "/admin/testes/capacidade",
        area: "capacity",
      });
    });

    const atRiskClients = health.atRiskClients.slice(0, 2);
    atRiskClients.forEach((client) => {
      nextAlerts.push({
        id: `health-${client.clienteId ?? client.clienteName}`,
        title: `${client.clienteName} em risco`,
        description: `Health score ${client.healthScore ?? "N/A"} com churn ${client.churn ?? "N/A"}%.`,
        severity: "warning",
        route: "/admin/testes/saude-cliente",
        area: "health",
      });
    });

    const overBudget = roi.summary?.projects
      .filter((project) => project.variancePercent > 10)
      .sort((a, b) => b.variancePercent - a.variancePercent)
      .slice(0, 2) ?? [];

    overBudget.forEach((project) => {
      nextAlerts.push({
        id: `roi-${project.projectId}`,
        title: `${project.projectName} acima do orcado`,
        description: `Variancia de +${project.variancePercent}% entre horas realizadas e contratadas.`,
        severity: "warning",
        route: "/admin/testes/roi",
        area: "roi",
      });
    });

    if (roi.projectsWithoutFinancialData > 0) {
      nextAlerts.push({
        id: "governance-financials",
        title: "Cobertura financeira incompleta",
        description: `${roi.projectsWithoutFinancialData} projeto(s) ainda sem base financeira para ROI.`,
        severity: "info",
        route: "/admin/testes/governanca-dados",
        area: "governance",
      });
    }

    return nextAlerts.slice(0, 6);
  }, [
    capacity.topConsultants,
    health.atRiskClients,
    roi.projectsWithoutFinancialData,
    roi.summary?.projects,
  ]);

  const coverage = useMemo<Sprint6DataCoverageItem[]>(() => {
    const projectTotal = roi.summary?.projects.length ?? 0;
    const projectWithFinancials = projectTotal - roi.projectsWithoutFinancialData;
    const projectWithContractedHours = projectTotal - roi.projectsWithoutContractedHours;
    const consultantsWithCapacity = capacity.topConsultants.filter((consultant) => consultant.availableHours != null).length;
    const healthConfigured = health.summary?.clients.length ?? 0;

    return [
      {
        id: "contracted-hours",
        label: "Base orcada de projetos",
        configured: Math.max(projectWithContractedHours, 0),
        total: projectTotal,
        route: "/admin/testes/governanca-dados",
        helper: "Horas contratadas cadastradas por projeto.",
      },
      {
        id: "financials",
        label: "Base financeira para ROI",
        configured: Math.max(projectWithFinancials, 0),
        total: projectTotal,
        route: "/admin/testes/governanca-dados",
        helper: "Receita e custo preenchidos para calculo economico.",
      },
      {
        id: "capacity",
        label: "Capacidade operacional",
        configured: consultantsWithCapacity,
        total: capacity.topConsultants.length,
        route: "/admin/testes/governanca-dados",
        helper: "Horas disponiveis e metadados de time por consultor.",
      },
      {
        id: "health",
        label: "Saude do cliente",
        configured: healthConfigured,
        total: health.clientOptions.length || healthConfigured,
        route: "/admin/testes/governanca-dados",
        helper: "Clientes com KPI, benchmark e score de saude.",
      },
    ];
  }, [
    capacity.topConsultants,
    health.clientOptions.length,
    health.summary?.clients.length,
    roi.projectsWithoutContractedHours,
    roi.projectsWithoutFinancialData,
    roi.summary?.projects.length,
  ]);

  return {
    roi,
    capacity,
    health,
    summary,
    alerts,
    coverage,
    loading: roi.loading || capacity.loading || health.loading,
    error: roi.error || capacity.error || health.error || null,
  };
}
