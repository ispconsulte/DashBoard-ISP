import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LatestDeadlineChange = {
  task_id: number;
  previous_deadline: string | null;
  new_deadline: string | null;
  detected_at: string;
  change_count: number;
};

function isMissingDeadlineChangesRelation(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  if (error.code === "PGRST205" || error.code === "42P01") return true;
  const message = String(error.message ?? "").toLowerCase();
  return message.includes("task_deadline_changes") && (
    message.includes("not found") ||
    message.includes("does not exist") ||
    message.includes("could not find")
  );
}

/**
 * Fetches the latest deadline change for a batch of task IDs.
 * Returns a map keyed by task_id.
 */
export function useDeadlineChanges(taskIds: (string | number | undefined | null)[]) {
  const [data, setData] = useState<Map<number, LatestDeadlineChange>>(new Map());
  const [loading, setLoading] = useState(false);

  // Stable key to avoid re-fetching on every render
  const ids = taskIds
    .map((id) => (id != null ? Number(id) : null))
    .filter((id): id is number => id != null && !isNaN(id));
  const key = ids.sort((a, b) => a - b).join(",");

  useEffect(() => {
    if (!ids.length) {
      setData(new Map());
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function load() {
      // Fetch all deadline changes for visible tasks, ordered by detected_at desc
      const { data: rows, error } = await supabase
        .from("task_deadline_changes")
        .select("task_id, previous_deadline, new_deadline, detected_at")
        .in("task_id", ids)
        .order("detected_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        if (isMissingDeadlineChangesRelation(error)) {
          setData(new Map());
          setLoading(false);
          return;
        }
        setLoading(false);
        return;
      }

      if (!rows) {
        setLoading(false);
        return;
      }

      // Group: keep only the latest change per task_id, plus count
      const countMap = new Map<number, number>();
      const latestMap = new Map<number, LatestDeadlineChange>();

      for (const row of rows as Array<{
        task_id: number;
        previous_deadline: string | null;
        new_deadline: string | null;
        detected_at: string;
      }>) {
        const tid = Number(row.task_id);
        countMap.set(tid, (countMap.get(tid) ?? 0) + 1);
        if (!latestMap.has(tid)) {
          latestMap.set(tid, {
            task_id: tid,
            previous_deadline: row.previous_deadline,
            new_deadline: row.new_deadline,
            detected_at: row.detected_at,
            change_count: 0,
          });
        }
      }

      for (const [tid, entry] of latestMap) {
        entry.change_count = countMap.get(tid) ?? 1;
      }

      setData(latestMap);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { deadlineChanges: data, loadingDeadlineChanges: loading };
}
