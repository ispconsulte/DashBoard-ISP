import { useEffect, useMemo, useState } from "react";
import { supabaseExt as supabase } from "@/lib/supabase";
import type { RoiPeriod } from "@/modules/sprint6/types";

export interface BonusScoreSnapshotRow {
  id: string;
  snapshot_kind: string;
  period_type: string;
  period_key: string;
  subject_key: string;
  user_id: string | null;
  subject_role: string | null;
  score: number;
  payout_amount: number;
  max_payout_amount: number;
  sync_status: string | null;
  source_provenance: string | null;
  source_updated_at: string | null;
  calculated_at: string;
  calculation_version: string | null;
  explanation: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BonusMetricBreakdownRow {
  id: string;
  snapshot_id: string;
  metric_code: string;
  metric_label: string;
  metric_group: string;
  metric_value: number | null;
  metric_target: number | null;
  metric_unit: string | null;
  meets_target: boolean | null;
  details: Record<string, unknown> | null;
  source_entity: string | null;
  source_provenance: string | null;
  source_record_key: string | null;
  source_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BonusInternalEvaluationRow {
  id: string;
  user_id: string | null;
  evaluation_scope: string;
  period_type: string;
  period_key: string;
  period_month: number | null;
  period_year: number | null;
  evaluator_user_id: string | null;
  category: string | null;
  subtopic: string | null;
  score_1_10: number | null;
  nps_score: number | null;
  soft_skill_score: number | null;
  people_skill_score: number | null;
  notes: string | null;
  justificativa: string | null;
  pontos_de_melhoria: string | null;
  status: string | null;
  submitted_by: string | null;
  submitted_at: string;
  source_provenance: string | null;
  source_form: string | null;
  source_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BonusSourceStatusRow {
  id: string;
  source_code: string;
  source_name: string;
  source_kind: string;
  entity_name: string | null;
  sync_status: string;
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface BonusPersistenceDataResult {
  loading: boolean;
  error: string | null;
  snapshots: BonusScoreSnapshotRow[];
  consultantSnapshots: BonusScoreSnapshotRow[];
  commercialSnapshots: BonusScoreSnapshotRow[];
  revenueSnapshots: BonusScoreSnapshotRow[];
  breakdowns: BonusMetricBreakdownRow[];
  evaluations: BonusInternalEvaluationRow[];
  sourceStatuses: BonusSourceStatusRow[];
  snapshotsBySubject: Map<string, BonusScoreSnapshotRow>;
  breakdownsBySnapshot: Map<string, BonusMetricBreakdownRow[]>;
  sourceStatusByCode: Map<string, BonusSourceStatusRow>;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function quarterKey(date: Date) {
  return `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
}

function buildMonthKeys(period: RoiPeriod) {
  if (period === "all") return null;

  const now = new Date();
  const months = period === "30d" ? 1 : period === "90d" ? 3 : 6;
  const keys: string[] = [];

  for (let offset = 0; offset < months; offset += 1) {
    const current = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    keys.push(monthKey(current));
  }

  return keys;
}

function buildQuarterKeys(period: RoiPeriod) {
  if (period === "all") return null;

  const now = new Date();
  const quarters = period === "30d" ? 1 : period === "90d" ? 1 : 2;
  const keys: string[] = [];

  for (let offset = 0; offset < quarters; offset += 1) {
    const current = new Date(now.getFullYear(), now.getMonth() - offset * 3, 1);
    keys.push(quarterKey(current));
  }

  return Array.from(new Set(keys));
}

export function useBonusPersistenceData(period: RoiPeriod = "180d", refreshKey = 0): BonusPersistenceDataResult {
  const AUTO_REFRESH_MS = 5 * 60 * 1000;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<BonusScoreSnapshotRow[]>([]);
  const [breakdowns, setBreakdowns] = useState<BonusMetricBreakdownRow[]>([]);
  const [evaluations, setEvaluations] = useState<BonusInternalEvaluationRow[]>([]);
  const [sourceStatuses, setSourceStatuses] = useState<BonusSourceStatusRow[]>([]);
  const [refreshTick, setRefreshTick] = useState(0);

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

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const monthKeys = buildMonthKeys(period);
        const quarterKeys = buildQuarterKeys(period);

        const snapshotsQuery = supabase
          .from("bonus_score_snapshots")
          .select("*")
          .order("period_key", { ascending: false })
          .order("calculated_at", { ascending: false });

        let evaluationsQuery = supabase
          .from("bonus_internal_evaluations")
          .select("*")
          .order("period_key", { ascending: false })
          .order("submitted_at", { ascending: false });

        if (monthKeys) {
          evaluationsQuery = evaluationsQuery.in("period_key", monthKeys);
        }

        const [snapshotsRes, evaluationsRes, sourceStatusesRes] = await Promise.all([
          snapshotsQuery,
          evaluationsQuery,
          supabase.from("bonus_source_statuses").select("*").order("source_code", { ascending: true }),
        ]);

        if (snapshotsRes.error) throw new Error(snapshotsRes.error.message);
        if (evaluationsRes.error) throw new Error(evaluationsRes.error.message);
        if (sourceStatusesRes.error) throw new Error(sourceStatusesRes.error.message);

        const snapshotRows = ((snapshotsRes.data ?? []) as BonusScoreSnapshotRow[]).filter((row) => {
          if (!monthKeys || !quarterKeys) return true;
          if (row.period_type === "month") return monthKeys.includes(row.period_key);
          if (row.period_type === "quarter") return quarterKeys.includes(row.period_key);
          return false;
        });
        const evaluationRows = (evaluationsRes.data ?? []) as BonusInternalEvaluationRow[];
        const sourceRows = (sourceStatusesRes.data ?? []) as BonusSourceStatusRow[];
        const snapshotIds = snapshotRows.map((row) => row.id);

        let breakdownRows: BonusMetricBreakdownRow[] = [];
        if (snapshotIds.length > 0) {
          const { data, error: breakdownsError } = await supabase
            .from("bonus_metric_breakdowns")
            .select("*")
            .in("snapshot_id", snapshotIds)
            .order("metric_group", { ascending: true })
            .order("metric_label", { ascending: true });

          if (breakdownsError) throw new Error(breakdownsError.message);
          breakdownRows = (data ?? []) as BonusMetricBreakdownRow[];
        }

        if (cancelled) return;

        setSnapshots(snapshotRows);
        setBreakdowns(breakdownRows);
        setEvaluations(evaluationRows);
        setSourceStatuses(sourceRows);
      } catch (loadError: any) {
        if (!cancelled) {
          setError(loadError?.message ?? "Erro ao carregar persistência de bonificação");
          setSnapshots([]);
          setBreakdowns([]);
          setEvaluations([]);
          setSourceStatuses([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [period, refreshKey, refreshTick]);

  const snapshotsBySubject = useMemo(() => {
    const map = new Map<string, BonusScoreSnapshotRow>();
    snapshots.forEach((row) => {
      map.set(`${row.snapshot_kind}:${row.subject_key}:${row.period_key}`, row);
    });
    return map;
  }, [snapshots]);

  const breakdownsBySnapshot = useMemo(() => {
    const map = new Map<string, BonusMetricBreakdownRow[]>();
    breakdowns.forEach((row) => {
      const current = map.get(row.snapshot_id) ?? [];
      current.push(row);
      map.set(row.snapshot_id, current);
    });
    return map;
  }, [breakdowns]);

  const sourceStatusByCode = useMemo(() => {
    const map = new Map<string, BonusSourceStatusRow>();
    sourceStatuses.forEach((row) => {
      map.set(row.source_code, row);
    });
    return map;
  }, [sourceStatuses]);

  return {
    loading,
    error,
    snapshots,
    consultantSnapshots: snapshots.filter((row) => row.snapshot_kind === "consultant_monthly"),
    commercialSnapshots: snapshots.filter((row) => row.snapshot_kind === "commercial_monthly"),
    revenueSnapshots: snapshots.filter((row) => row.snapshot_kind === "revenue_quarterly"),
    breakdowns,
    evaluations,
    sourceStatuses,
    snapshotsBySubject,
    breakdownsBySnapshot,
    sourceStatusByCode,
  };
}
