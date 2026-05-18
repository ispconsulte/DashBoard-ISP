import { useEffect, useRef, useState } from "react";
import { supabaseExt as supabase } from "@/lib/supabase";
import {
  BONUS_PAYOUT_BY_SENIORITY,
} from "@/modules/sprint6/bonusEvaluation";

export interface BonusConfig {
  payoutJunior: number;
  payoutPleno: number;
  payoutSenior: number;
  payoutSdr: number;
  payoutCroMonthly: number;
  thresholdOntimePct: number;
  thresholdHealthPts: number;
  thresholdMarginPct: number;
  utilizationMinPct: number;
  utilizationMaxPct: number;
}

export const BONUS_CONFIG_DEFAULTS: BonusConfig = {
  payoutJunior:       BONUS_PAYOUT_BY_SENIORITY.junior,
  payoutPleno:        BONUS_PAYOUT_BY_SENIORITY.pleno,
  payoutSenior:       BONUS_PAYOUT_BY_SENIORITY.senior,
  payoutSdr:          BONUS_PAYOUT_BY_SENIORITY.sdr,
  payoutCroMonthly:   1500,
  thresholdOntimePct: 95,
  thresholdHealthPts: 80,
  thresholdMarginPct: 30,
  utilizationMinPct:  70,
  utilizationMaxPct:  95,
};

const KEY_MAP: Record<string, keyof BonusConfig> = {
  payout_junior:        "payoutJunior",
  payout_pleno:         "payoutPleno",
  payout_senior:        "payoutSenior",
  payout_sdr:           "payoutSdr",
  payout_cro_monthly:   "payoutCroMonthly",
  threshold_ontime_pct: "thresholdOntimePct",
  threshold_health_pts: "thresholdHealthPts",
  threshold_margin_pct: "thresholdMarginPct",
  utilization_min_pct:  "utilizationMinPct",
  utilization_max_pct:  "utilizationMaxPct",
};

const ALL_KEYS = Object.keys(KEY_MAP);

/**
 * Fetches bonus config from bonus_settings once per session.
 * Falls back to BONUS_CONFIG_DEFAULTS for any missing key.
 */
export function useBonusConfig(): BonusConfig {
  const cacheRef = useRef<BonusConfig | null>(null);
  const [config, setConfig] = useState<BonusConfig>(BONUS_CONFIG_DEFAULTS);

  useEffect(() => {
    if (cacheRef.current) return;

    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from("bonus_settings")
        .select("key, value_numeric, value")
        .in("key", ALL_KEYS);

      if (cancelled || error || !data) return;

      const merged: BonusConfig = { ...BONUS_CONFIG_DEFAULTS };

      for (const row of data as { key: string; value_numeric: number | null; value: string | null }[]) {
        const field = KEY_MAP[row.key];
        if (!field) continue;
        const numeric = row.value_numeric ?? (row.value != null ? Number(row.value) : NaN);
        if (Number.isFinite(numeric)) {
          (merged as any)[field] = numeric;
        }
      }

      cacheRef.current = merged;
      if (!cancelled) setConfig(merged);
    };

    void load();
    return () => { cancelled = true; };
  }, []);

  return config;
}
