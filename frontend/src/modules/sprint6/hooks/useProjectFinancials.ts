// ── Sprint 6.0 — Project Financials hook ────────────────────────────
// Reads from project_financials table (Lovable Cloud).
// Provides financial data per project for ROI % calculation.

import { useEffect, useState } from "react";
import { supabaseExt as supabase } from "@/lib/supabase";

export interface ProjectFinancialRow {
  id: string;
  project_id: number;
  receita_projeto: number;
  custo_hora: number;
  custo_total_estimado: number;
  observacoes: string | null;
}

export interface UseProjectFinancialsReturn {
  /** Map of project_id → financial data */
  data: Map<number, ProjectFinancialRow>;
  loading: boolean;
  error: string | null;
}

export function useProjectFinancials(accessToken?: string | null): UseProjectFinancialsReturn {
  const AUTO_REFRESH_MS = 5 * 60 * 1000;
  const [data, setData] = useState<Map<number, ProjectFinancialRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    const isMissingRelation = (message: string) => {
      const normalized = message.toLowerCase();
      return (
        normalized.includes("project_financials") &&
        (normalized.includes("does not exist") || normalized.includes("could not find") || normalized.includes("relation"))
      );
    };

    const fetch = async () => {
      if (!accessToken) {
        setData(new Map());
        setError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const { data: rows, error: err } = await supabase
          .from("project_financials")
          .select("id, project_id, receita_projeto, custo_hora, custo_total_estimado, observacoes");
        if (err) {
          if (isMissingRelation(err.message ?? "")) {
            if (!cancelled) {
              setData(new Map());
              setError(null);
            }
            return;
          }
          throw new Error(err.message);
        }
        if (cancelled) return;
        const map = new Map<number, ProjectFinancialRow>();
        for (const r of rows ?? []) {
          map.set(Number(r.project_id), {
            id: r.id,
            project_id: Number(r.project_id),
            receita_projeto: Number(r.receita_projeto) || 0,
            custo_hora: Number(r.custo_hora) || 0,
            custo_total_estimado: Number(r.custo_total_estimado) || 0,
            observacoes: r.observacoes ?? null,
          });
        }
        setData(map);
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? "Erro ao carregar dados financeiros");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    return () => { cancelled = true; };
  }, [accessToken, refreshTick]);

  return { data, loading, error };
}
