import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseExt as supabase } from "@/lib/supabase";
import type { BonusEvaluationNotificationRow } from "@/modules/sprint6/hooks/useBonusPersistenceData";

export type BonusNotificationItem = BonusEvaluationNotificationRow & {
  evaluatorName?: string;
};

interface Options {
  userId: string | null | undefined;
  /** Delay in ms before showing deferred (offline) notifications after login. Default: 3 min */
  deferredDelayMs?: number;
}

const SESSION_SEEN_KEY = "bonus_notif_seen_ids";

function getSeenIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SESSION_SEEN_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function markSeen(id: string) {
  try {
    const ids = getSeenIds();
    ids.add(id);
    sessionStorage.setItem(SESSION_SEEN_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

async function fetchEvaluatorName(evaluatorUserId: string): Promise<string | undefined> {
  const { data } = await supabase
    .from("users")
    .select("name")
    .eq("id", evaluatorUserId)
    .maybeSingle();
  return (data as any)?.name ?? undefined;
}

/**
 * Manages bonus evaluation notification display for the current user.
 * Returns a queue of pending notifications and a dismiss function.
 * - Online: surfaces immediately via Realtime postgres_changes.
 * - Offline/deferred: shown `deferredDelayMs` after mount (default 3min), once per session.
 */
export function useBonusEvaluationNotifier({
  userId,
  deferredDelayMs = 3 * 60 * 1000,
}: Options) {
  const [queue, setQueue] = useState<BonusNotificationItem[]>([]);
  const seenRef = useRef<Set<string>>(getSeenIds());
  const deferredTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const enqueue = useCallback((item: BonusNotificationItem) => {
    if (seenRef.current.has(item.id)) return;
    setQueue((prev) => {
      if (prev.some((n) => n.id === item.id)) return prev;
      return [...prev, item];
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    markSeen(id);
    seenRef.current.add(id);
    setQueue((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setQueue((prev) => {
      prev.forEach((n) => {
        markSeen(n.id);
        seenRef.current.add(n.id);
      });
      return [];
    });
  }, []);

  // Load pending (unread, not opened) notifications from DB and schedule deferred show
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    const loadDeferred = async () => {
      const { data, error } = await supabase
        .from("bonus_evaluation_notifications")
        .select("*")
        .eq("user_id", userId)
        .is("opened_at", null)
        .order("created_at", { ascending: false });

      if (cancelled || error || !data) return;

      const rows = (data as BonusEvaluationNotificationRow[]).filter(
        (row) => !seenRef.current.has(row.id),
      );
      if (rows.length === 0) return;

      const enriched = await Promise.all(
        rows.map(async (row) => ({
          ...row,
          evaluatorName: await fetchEvaluatorName(row.evaluator_user_id),
        })),
      );

      if (cancelled) return;

      deferredTimerRef.current = setTimeout(() => {
        if (!cancelled) {
          enriched.forEach((item) => enqueue(item));
        }
      }, deferredDelayMs);
    };

    void loadDeferred();

    return () => {
      cancelled = true;
      if (deferredTimerRef.current) clearTimeout(deferredTimerRef.current);
    };
  }, [userId, deferredDelayMs, enqueue]);

  // Realtime subscription: show immediately when a new notification arrives
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`bonus-notif-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bonus_evaluation_notifications",
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          const row = payload.new as BonusEvaluationNotificationRow;
          if (seenRef.current.has(row.id)) return;
          const evaluatorName = await fetchEvaluatorName(row.evaluator_user_id);
          enqueue({ ...row, evaluatorName });
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [userId, enqueue]);

  const current = queue[0] ?? null;

  return { current, queueLength: queue.length, dismiss, dismissAll };
}
