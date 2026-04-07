// ── Sprint 6.0 — Shared Types ──────────────────────────────────────
// All types/interfaces used across the test-area dashboards.
// Keep this file as the single source of truth for Sprint 6.0 data contracts.

/** Generic filter state shared by all dashboards */
export interface DashboardFilters {
  dateRange: { from: Date | null; to: Date | null };
  projectId: number | null;
  department: string | null;
  /** Used by Capacity dashboard */
  seniorityLevel: "senior" | "pleno" | "junior" | null;
  /** Used by Client Health dashboard */
  clienteId: number | null;
}

export const DEFAULT_FILTERS: DashboardFilters = {
  dateRange: { from: null, to: null },
  projectId: null,
  department: null,
  seniorityLevel: null,
  clienteId: null,
};

// ── Dashboard ROI ──────────────────────────────────────────────────

export interface RoiProjectData {
  projectId: number;
  projectName: string;
  hoursContracted: number;
  hoursUsed: number;
  variancePercent: number;
  /** ROI = (revenue - cost) / cost * 100  — requires financial data */
  roiPercent: number | null;
}

export interface RoiSummary {
  totalContracted: number;
  totalUsed: number;
  overallVariance: number;
  projects: RoiProjectData[];
}

/** Monthly aggregation of realized hours for trend chart */
export interface RoiMonthlyTrend {
  month: string;       // "2025-01"
  hoursUsed: number;
}

/** Period options supported by ROI filters */
export type RoiPeriod = "30d" | "90d" | "180d" | "all";

/** Resolved date range from a period selection */
export interface DateRange {
  startIso: string;
  endIso: string;
}

/** Resolves a RoiPeriod into ISO date strings */
export function resolvePeriod(period: RoiPeriod): DateRange {
  const now = new Date();
  if (period === "all") {
    return {
      startIso: "2020-01-01",
      endIso: now.toISOString().split("T")[0],
    };
  }
  const days = period === "30d" ? 30 : period === "90d" ? 90 : 180;
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    startIso: start.toISOString().split("T")[0],
    endIso: now.toISOString().split("T")[0],
  };
}

/** Computes variance % safely */
export function calcVariance(used: number, contracted: number): number {
  if (contracted <= 0) return 0;
  return Math.round(((used - contracted) / contracted) * 1000) / 10;
}

// ── Dashboard Capacidade ───────────────────────────────────────────

export type SeniorityLevel = "senior" | "pleno" | "junior";

export interface CapacityUser {
  userId: string;
  userName: string;
  department: string | null;
  seniority: SeniorityLevel | null;
  availableHours: number;
  allocatedHours: number;
  utilizationPercent: number;
}

export interface CapacityProjectLoad {
  projectId: number;
  projectName: string;
  totalHours: number;
  percentOfTotal: number;
}

export interface CapacitySummary {
  users: CapacityUser[];
  projectLoad: CapacityProjectLoad[];
  overloadedUsers: CapacityUser[];
}

// ── Dashboard Saúde do Cliente ─────────────────────────────────────

export interface ClientKpi {
  clienteId: number | null;
  clienteName: string;
  ebitda: number | null;
  churn: number | null;
  nps: number | null;
  /** Composite health score (0-100) */
  healthScore: number | null;
  isAtRisk: boolean;
}

export interface ClientKpiTrend {
  month: string;          // "2025-01", "2025-02", …
  ebitda: number | null;
  churn: number | null;
  nps: number | null;
}

export interface ClientHealthSummary {
  clients: ClientKpi[];
  trends: ClientKpiTrend[];
  benchmarks: {
    ebitda: number;
    churn: number;
    nps: number;
  } | null;
}

export interface ClientKpiRow {
  id: string;
  clienteId: number | null;
  clienteName: string;
  month: string;
  ebitda: number | null;
  churn: number | null;
  nps: number | null;
}

// ── Executive hub ───────────────────────────────────────────────────

export type InsightSeverity = "info" | "warning" | "critical";

export interface Sprint6ExecutiveAlert {
  id: string;
  title: string;
  description: string;
  severity: InsightSeverity;
  route: string;
  area: "overview" | "roi" | "capacity" | "health" | "governance";
}

export interface Sprint6DataCoverageItem {
  id: string;
  label: string;
  configured: number;
  total: number;
  route: string;
  helper: string;
}

export interface Sprint6ExecutiveSummary {
  totalProjects: number;
  totalClients: number;
  totalTrackedHours: number;
  roiAverage: number | null;
  averageUtilization: number | null;
  averageHealthScore: number | null;
  overloadedConsultants: number;
  atRiskClients: number;
  overBudgetProjects: number;
}

// ── Module status (used by the area-testes hub page) ───────────────

export type ModuleStatus = "pendente" | "parcial" | "pronto";

export interface TestModule {
  id: string;
  title: string;
  description: string;
  status: ModuleStatus;
}
