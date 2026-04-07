// ── Sprint 6.0 — Client Health data hook ───────────────────────────
// Reads from client_kpis and client_benchmarks tables.
// Calculates health score and at-risk status.

import { useEffect, useMemo, useState } from "react";
import { supabaseExt as supabase } from "@/lib/supabase";
import type {
  ClientHealthSummary,
  ClientKpi,
  ClientKpiRow,
  ClientKpiTrend,
} from "@/modules/sprint6/types";

interface UseClientHealthOptions {
  accessToken?: string;
  month?: string; // "2025-03" — if omitted, fetches all months
}

export interface ClientHealthDataResult {
  summary: ClientHealthSummary | null;
  atRiskClients: ClientKpi[];
  loading: boolean;
  error: string | null;
  isEmpty: boolean;
  notConfigured: boolean;
  missingDependencies: string[];
  /** Distinct client names for filter dropdowns */
  clientOptions: { id: number; name: string }[];
  /** Raw KPI rows for per-client trend filtering */
  kpiRows: ClientKpiRow[];
}

// Weights: configurable via health_score_config table, fallback to defaults.
// Each KPI is normalized 0-100 relative to benchmarks.

const DEFAULT_WEIGHTS = { ebitda: 0.4, churn: 0.3, nps: 0.3 };

function calcHealthScore(
  ebitda: number | null,
  churn: number | null,
  nps: number | null,
  benchmarks: { ebitda: number; churn: number; nps: number } | null,
  weights: { ebitda: number; churn: number; nps: number },
): number | null {
  const b = benchmarks ?? { ebitda: 100000, churn: 5, nps: 50 };
  let score = 0;
  let totalWeight = 0;

  if (ebitda != null && b.ebitda > 0) {
    const ratio = Math.min(ebitda / b.ebitda, 2) * 50;
    score += ratio * weights.ebitda;
    totalWeight += weights.ebitda;
  }
  if (churn != null && b.churn > 0) {
    const ratio = Math.max(0, Math.min(100, (1 - churn / (b.churn * 2)) * 100));
    score += ratio * weights.churn;
    totalWeight += weights.churn;
  }
  if (nps != null) {
    const normalized = Math.max(0, Math.min(100, ((nps + 100) / 200) * 100));
    score += normalized * weights.nps;
    totalWeight += weights.nps;
  }

  if (totalWeight === 0) return null;
  return Math.round((score / totalWeight) * 10) / 10;
}

const RISK_THRESHOLD = 40;

export function useClientHealthData(opts: UseClientHealthOptions): ClientHealthDataResult {
  const AUTO_REFRESH_MS = 5 * 60 * 1000;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // Raw data from DB
  const [kpiRows, setKpiRows] = useState<ClientKpiRow[]>([]);
  const [benchmarkRow, setBenchmarkRow] = useState<{
    ebitda_avg: number | null;
    churn_avg: number | null;
    nps_avg: number | null;
  } | null>(null);
  const [configWeights, setConfigWeights] = useState(DEFAULT_WEIGHTS);

  // Fetch data
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setRefreshTick((current) => current + 1);
    }, AUTO_REFRESH_MS);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        setRefreshTick((current) => current + 1);
      }
    };

    window.addEventListener("focus", handleVisibility);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleVisibility);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      if (!opts.accessToken) {
        setKpiRows([]);
        setBenchmarkRow(null);
        setConfigWeights(DEFAULT_WEIGHTS);
        setError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const [kpiPayload, benchRes, weightsRes] = await Promise.all([
          supabase
            .from("client_kpis")
            .select("id, cliente_name, month, ebitda, churn, nps")
            .order("month", { ascending: false }),
          supabase.from("client_benchmarks").select("ebitda_avg, churn_avg, nps_avg").limit(1),
          supabase.from("health_score_config" as any).select("weight_ebitda, weight_churn, weight_nps").limit(1),
        ]);
        if (kpiPayload.error) {
          throw new Error(kpiPayload.error.message);
        }
        if (cancelled) return;
        setKpiRows(
          ((kpiPayload.data as any[]) ?? []).map((row) => ({
            id: String(row.id),
            clienteId: null,
            clienteName: String(row.cliente_name ?? "").trim(),
            month: String(row.month),
            ebitda: row.ebitda != null ? Number(row.ebitda) : null,
            churn: row.churn != null ? Number(row.churn) : null,
            nps: row.nps != null ? Number(row.nps) : null,
          })),
        );
        setBenchmarkRow((benchRes.data as any)?.[0] ?? null);
        const wRow = (weightsRes.data as any)?.[0];
        if (wRow) {
          setConfigWeights({
            ebitda: Number(wRow.weight_ebitda) || DEFAULT_WEIGHTS.ebitda,
            churn: Number(wRow.weight_churn) || DEFAULT_WEIGHTS.churn,
            nps: Number(wRow.weight_nps) || DEFAULT_WEIGHTS.nps,
          });
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? "Erro ao carregar KPIs");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [opts.accessToken, opts.month, refreshTick]);

  // Derive benchmarks
  const benchmarks = useMemo(() => {
    if (!benchmarkRow) return null;
    return {
      ebitda: benchmarkRow.ebitda_avg ?? 100000,
      churn: benchmarkRow.churn_avg ?? 5,
      nps: benchmarkRow.nps_avg ?? 50,
    };
  }, [benchmarkRow]);

  // Build summary
  const summary = useMemo<ClientHealthSummary | null>(() => {
    if (!kpiRows.length) return null;

    // Get latest month per client for the "current" KPI snapshot
    const latestByClient = new Map<string, ClientKpiRow>();
    for (const row of kpiRows) {
      const clientKey = row.clienteId != null ? `id:${row.clienteId}` : `name:${row.clienteName}`;
      const existing = latestByClient.get(clientKey);
      if (!existing || row.month > existing.month) {
        latestByClient.set(clientKey, row);
      }
    }

    const clients: ClientKpi[] = Array.from(latestByClient.values()).map((row) => {
      const healthScore = calcHealthScore(row.ebitda, row.churn, row.nps, benchmarks, configWeights);
      return {
        clienteId: row.clienteId,
        clienteName: row.clienteName,
        ebitda: row.ebitda,
        churn: row.churn,
        nps: row.nps,
        healthScore,
        isAtRisk: healthScore != null && healthScore < RISK_THRESHOLD,
      };
    });

    // Build trends (aggregate by month)
    const trendMap = new Map<string, { ebitda: number[]; churn: number[]; nps: number[] }>();
    for (const row of kpiRows) {
      const t = trendMap.get(row.month) ?? { ebitda: [], churn: [], nps: [] };
      if (row.ebitda != null) t.ebitda.push(row.ebitda);
      if (row.churn != null) t.churn.push(row.churn);
      if (row.nps != null) t.nps.push(row.nps);
      trendMap.set(row.month, t);
    }

    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

    const trends: ClientKpiTrend[] = Array.from(trendMap.entries())
      .map(([month, t]) => ({
        month,
        ebitda: avg(t.ebitda),
        churn: avg(t.churn),
        nps: avg(t.nps),
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return { clients, trends, benchmarks };
  }, [kpiRows, benchmarks, configWeights]);

  const atRiskClients = useMemo<ClientKpi[]>(() => {
    if (!summary) return [];
    return summary.clients
      .filter((c) => c.isAtRisk)
      .sort((a, b) => (a.healthScore ?? 100) - (b.healthScore ?? 100));
  }, [summary]);

  const clientOptions = useMemo(() => {
    const latestByClient = new Map<string, { id: number; name: string }>();
    for (const row of kpiRows) {
      const normalizedName = row.clienteName.trim();
      const clientId = row.clienteId;
      const fallbackId = Number(row.id.replace(/\D/g, "").slice(0, 9) || 0);
      const optionId = clientId ?? fallbackId;
      if (!normalizedName || optionId === 0) continue;
      latestByClient.set(clientId != null ? `id:${clientId}` : `name:${normalizedName}`, {
        id: optionId,
        name: normalizedName,
      });
    }
    return Array.from(latestByClient.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [kpiRows]);

  const isEmpty = !loading && !error && kpiRows.length === 0;

  return {
    summary,
    atRiskClients,
    loading,
    error,
    isEmpty,
    notConfigured: false,
    clientOptions,
    kpiRows,
    missingDependencies: [
      "Esta visao depende de registros em client_kpis, benchmark em client_benchmarks e relacionamento de clientes ativo na base.",
      "A alimentacao automatica ainda nao chegou da operacao/CRM; por enquanto essa visao depende de cadastro controlado.",
    ],
  };
}
