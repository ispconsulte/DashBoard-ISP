import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseExt as supabase } from "@/lib/supabase";

export interface PresenceEntry {
  auth_user_id: string;
  name: string;
  email: string;
  online_at: string;
}

const PRESENCE_CHANNEL = "isp-user-presence";
const PRESENCE_STALE_TTL_MS = 45_000;

async function waitForSession(cancelled: () => boolean): Promise<boolean> {
  for (let attempt = 0; attempt < 10; attempt++) {
    if (cancelled()) return false;
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) return true;
    await new Promise((r) => setTimeout(r, 800));
  }
  console.warn("[Presence] session não ficou disponível após tentativas");
  return false;
}

export function useTrackPresence(
  email: string | undefined,
  name: string | undefined,
  _emailDup?: string | undefined,
) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const cleaningChannelRef = useRef(false);

  const normalizedEmail = useMemo(() => String(email ?? "").trim().toLowerCase(), [email]);

  useEffect(() => {
    if (!normalizedEmail) return;

    let cancelled = false;

    const clearReconnect = () => {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const cleanupChannel = async (channelToCleanup?: ReturnType<typeof supabase.channel> | null) => {
      const channel = channelToCleanup ?? channelRef.current;
      if (!channel || cleaningChannelRef.current) return;

      cleaningChannelRef.current = true;
      try {
        if (channelRef.current === channel) {
          channelRef.current = null;
        }
        await channel.untrack();
        await supabase.removeChannel(channel);
      } finally {
        cleaningChannelRef.current = false;
      }
    };

    const startTracking = async () => {
      const ready = await waitForSession(() => cancelled);
      if (!ready || cancelled) return;

      const channel = supabase.channel(PRESENCE_CHANNEL, {
        config: { presence: { key: normalizedEmail } },
      });

      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState<PresenceEntry>();
          const own = state[normalizedEmail];
          if (!own || own.length === 0) {
            void channel.track({
              auth_user_id: normalizedEmail,
              name: (name || normalizedEmail.split("@")[0] || "Usuário").trim(),
              email: normalizedEmail,
              online_at: new Date().toISOString(),
            } satisfies PresenceEntry);
          }
        })
        .subscribe(async (status) => {
          if (cancelled) return;

          if (status === "SUBSCRIBED") {
            await channel.track({
              auth_user_id: normalizedEmail,
              name: (name || normalizedEmail.split("@")[0] || "Usuário").trim(),
              email: normalizedEmail,
              online_at: new Date().toISOString(),
            } satisfies PresenceEntry);
            return;
          }

          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            clearReconnect();
            void cleanupChannel(channel);
            reconnectTimerRef.current = window.setTimeout(() => {
              if (!cancelled) void startTracking();
            }, 1200);
          }
        });

      channelRef.current = channel;
    };

    void startTracking();

    return () => {
      cancelled = true;
      clearReconnect();
      void cleanupChannel();
    };
  }, [normalizedEmail, name]);
}

export function useOnlineUsers(): Map<string, PresenceEntry> {
  const [onlineMap, setOnlineMap] = useState<Map<string, PresenceEntry>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const cacheRef = useRef<Map<string, { entry: PresenceEntry; seenAt: number }>>(new Map());

  useEffect(() => {
    let cancelled = false;

    const publishFromCache = () => {
      const now = Date.now();
      const map = new Map<string, PresenceEntry>();
      cacheRef.current.forEach(({ entry, seenAt }, key) => {
        if (now - seenAt <= PRESENCE_STALE_TTL_MS) {
          map.set(key, entry);
        }
      });
      setOnlineMap(map);
    };

    const syncState = () => {
      const channel = channelRef.current;
      if (!channel) return;

      const state = channel.presenceState<PresenceEntry>();
      const now = Date.now();

      Object.values(state).forEach((entries) => {
        const sorted = [...entries].sort(
          (a, b) => new Date(b.online_at).getTime() - new Date(a.online_at).getTime(),
        );
        const entry = sorted[0];
        if (entry?.email && entry.email !== "__observer__") {
          cacheRef.current.set(entry.email.trim().toLowerCase(), {
            entry,
            seenAt: now,
          });
        }
      });

      publishFromCache();
    };

    const startObserving = async () => {
      const ready = await waitForSession(() => cancelled);
      if (!ready || cancelled) return;

      const channel = supabase.channel(PRESENCE_CHANNEL, {
        config: { presence: { key: "__observer__" } },
      });

      channel
        .on("presence", { event: "sync" }, syncState)
        .on("presence", { event: "join" }, syncState)
        .on("presence", { event: "leave" }, syncState)
        .subscribe((status) => {
          if (status === "SUBSCRIBED") syncState();
        });

      channelRef.current = channel;
    };

    const gcTimer = window.setInterval(() => {
      const now = Date.now();
      cacheRef.current.forEach((value, key) => {
        if (now - value.seenAt > PRESENCE_STALE_TTL_MS) {
          cacheRef.current.delete(key);
        }
      });
      publishFromCache();
    }, 8_000);

    void startObserving();

    return () => {
      cancelled = true;
      window.clearInterval(gcTimer);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      cacheRef.current.clear();
      setOnlineMap(new Map());
    };
  }, []);

  return onlineMap;
}
