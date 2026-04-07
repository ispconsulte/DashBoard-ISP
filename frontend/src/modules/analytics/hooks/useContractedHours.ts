import { useState, useEffect, useCallback } from "react";
import { supabaseExt as supabase } from "@/lib/supabase";

// Graceful fallback: if the table doesn't exist yet, return empty data silently
const TABLE_NAME = "project_contracted_hours";

export type ContractedHoursRecord = {
  project_id: number;
  contracted_hours: number;
  notes?: string | null;
  updated_by?: string | null;
  updated_at?: string | null;
};

export function useContractedHours() {
  const [data, setData] = useState<Map<number, ContractedHoursRecord>>(new Map());
  const [loading, setLoading] = useState(false);
  const [tableExists, setTableExists] = useState<boolean | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from(TABLE_NAME as any)
        .select("project_id, contracted_hours, notes, updated_by, updated_at");

      // If table doesn't exist (error code 42P01 or PGRST116), silently skip
      if (error) {
        const msg = String(error.message ?? "");
        const code = String((error as any).code ?? "");
        if (
          msg.includes("does not exist") ||
          msg.includes("relation") ||
          code === "42P01" ||
          code === "PGRST116"
        ) {
          setTableExists(false);
          setData(new Map());
          return;
        }
        // Any other error — log but don't crash
        console.warn("[useContractedHours] fetch error:", error);
        return;
      }

      setTableExists(true);
      const map = new Map<number, ContractedHoursRecord>();
      (rows ?? []).forEach((r: any) => {
        map.set(Number(r.project_id), r as ContractedHoursRecord);
      });
      setData(map);
    } catch (err) {
      console.warn("[useContractedHours] fetch failed", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  const upsert = useCallback(
    async (projectId: number, contractedHours: number, updatedBy: string, notes?: string): Promise<boolean> => {
      if (tableExists === false) {
        console.warn("[useContractedHours] table not available, skipping upsert");
        return false;
      }
      try {
        const { error } = await supabase
          .from(TABLE_NAME as any)
          .upsert(
            {
              project_id: projectId,
              contracted_hours: contractedHours,
              updated_by: updatedBy,
              notes: notes ?? null,
            },
            { onConflict: "project_id" }
          );
        if (error) throw error;
        await fetch();
        return true;
      } catch (err) {
        console.error("[useContractedHours] upsert failed", err);
        return false;
      }
    },
    [fetch, tableExists]
  );

  return { data, loading, refetch: fetch, upsert, tableExists };
}
