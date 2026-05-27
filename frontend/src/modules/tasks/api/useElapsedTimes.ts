import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { storage } from "@/modules/shared/storage";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import type { ElapsedTimeRecord } from "../types";
import { getElapsedEffectiveDate, parseDateValue, parseLocalDateInput } from "../utils";

type UseElapsedTimesResult = {
  times: ElapsedTimeRecord[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  lastUpdated: number | null;
  reloadCooldownMsLeft: number;
  noChanges: boolean;
};

type UseElapsedTimesParams = {
  accessToken?: string | null;
  period?: string;
  dateFrom?: string;
  dateTo?: string;
  dateField?: "reference_date" | "created_date";
};

const CACHE_KEY = "cache:elapsed_times:v4";
const RELOAD_COOLDOWN_MS = 12_000; // 5 reloads per minute → 60s / 5 = 12s
const MAX_RELOADS_PER_MINUTE = 5;
const REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_TASKS_TIMEOUT_MS ?? "25000");
const PAGE_SIZE = 1000;
const MAX_PAGES = 10;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour — stale cache is ignored on hydration

const ALL_CAP_DAYS = 365; // server-side cap for period="all"

const buildPeriodKey = (
  dateField: "reference_date" | "created_date",
  period?: string,
  dateFrom?: string,
  dateTo?: string,
) => `${dateField}:${period === "custom" ? `custom:${dateFrom ?? ""}:${dateTo ?? ""}` : period ?? "all"}`;

const buildDateFilter = (
  period?: string,
  dateFrom?: string,
  dateTo?: string,
  dateField: "reference_date" | "created_date" = "reference_date",
): string => {
  if (!period || period === "all") {
    // Cap "all" to ALL_CAP_DAYS so the query stays bounded
    const from = new Date(Date.now() - ALL_CAP_DAYS * 24 * 60 * 60 * 1000);
    const iso = encodeURIComponent(from.toISOString());
    return `${dateField}=gte.${iso}`;
  }
  if (period !== "custom") {
    const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 180;
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const iso = encodeURIComponent(from.toISOString());
    return `${dateField}=gte.${iso}`;
  }
  // custom range
  const parts: string[] = [];
  if (dateFrom) {
    const f = parseLocalDateInput(dateFrom);
    if (f && !Number.isNaN(f.getTime())) {
      const iso = encodeURIComponent(f.toISOString());
      parts.push(`${dateField}=gte.${iso}`);
    }
  }
  if (dateTo) {
    const t = parseLocalDateInput(dateTo, true);
    if (t && !Number.isNaN(t.getTime())) {
      const iso = encodeURIComponent(t.toISOString());
      parts.push(`${dateField}=lte.${iso}`);
    }
  }
  if (parts.length > 0) return parts.join("&");
  return "";
};

const buildEndpoint = (
  period?: string,
  dateFrom?: string,
  dateTo?: string,
  dateField: "reference_date" | "created_date" = "reference_date",
) => {
  const url = SUPABASE_URL;
  const key = SUPABASE_ANON_KEY;

  if (!url || !key) {
    return {
      endpoint: null,
      latestEndpoint: null,
      key: null,
      error: "Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.",
    };
  }

  const base = url.replace(/\/$/, "");
  const select = [
    "id",
    "task_id",
    "bitrix_task_id_raw",
    "orphan_reason",
    "orphan_detected_at",
    "user_id",
    "comment_text",
    "date_start",
    "created_date",
    "date_stop",
    "reference_date",
    "minutes",
    "seconds",
    "local_state",
    "inserted_at",
    "updated_at",
  ].join(",");
  const dateFilter = buildDateFilter(period, dateFrom, dateTo, dateField);
  const filterSuffix = dateFilter ? `&${dateFilter}` : "";
  const activeFilter = "local_state=eq.active";
  const endpoint = `${base}/rest/v1/operational_elapsed_times?select=${encodeURIComponent(select)}&${activeFilter}${filterSuffix}`;
  const latestEndpoint = `${base}/rest/v1/operational_elapsed_times?select=updated_at,inserted_at,created_date,date_start,reference_date&order=updated_at.desc&limit=1&${activeFilter}${filterSuffix}`;
  return { endpoint, latestEndpoint, key, error: null };
};

const getElapsedFilterDate = (row: ElapsedTimeRecord, dateField: "reference_date" | "created_date") =>
  dateField === "created_date" ? parseDateValue(row.created_date) : getElapsedEffectiveDate(row);

const filterByEffectivePeriod = (
  rows: ElapsedTimeRecord[],
  period?: string,
  dateFrom?: string,
  dateTo?: string,
  dateField: "reference_date" | "created_date" = "reference_date",
) => {
  if (period === "all") return rows;

  let from: Date | null = null;
  let to: Date | null = null;

  if (period && period !== "all" && period !== "custom") {
    const now = new Date();
    const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 180;
    from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  } else if (period === "custom") {
    if (dateFrom) {
      const parsedFrom = parseLocalDateInput(dateFrom);
      if (parsedFrom && !Number.isNaN(parsedFrom.getTime())) from = parsedFrom;
    }
    if (dateTo) {
      const parsedTo = parseLocalDateInput(dateTo, true);
      if (parsedTo && !Number.isNaN(parsedTo.getTime())) {
        to = parsedTo;
      }
    }
  }

  return rows.filter((row) => {
    const effective = getElapsedFilterDate(row, dateField);
    if (!effective) return false;
    if (from && effective < from) return false;
    if (to && effective > to) return false;
    return true;
  });
};

const normalizeSeconds = (record: Partial<ElapsedTimeRecord> & { minutes?: number; seconds?: number }) => {
  if (typeof record.seconds === "number" && Number.isFinite(record.seconds)) return record.seconds;
  if (typeof record.minutes === "number" && Number.isFinite(record.minutes)) return record.minutes * 60;
  const sec = Number(record.seconds);
  if (!Number.isNaN(sec)) return sec;
  const min = Number(record.minutes);
  return Number.isNaN(min) ? 0 : min * 60;
};

export function useElapsedTimes(params: UseElapsedTimesParams = {}): UseElapsedTimesResult {
  const { period = "all", dateFrom, dateTo, dateField = "reference_date" } = params;
  const { endpoint, latestEndpoint, key, error: envError } = useMemo(
    () => buildEndpoint(period, dateFrom, dateTo, dateField),
    [period, dateFrom, dateTo, dateField]
  );

  // Hydrate from cache on mount so UI renders instantly (only if within TTL)
  const initialCache = useMemo(() => {
    const periodKey = buildPeriodKey(dateField, period, dateFrom, dateTo);
    const cached = storage.get<{ data: ElapsedTimeRecord[]; timestamp: number } | null>(`${CACHE_KEY}:${periodKey}`, null);
    if (!cached?.data?.length) return null;
    if (Date.now() - (cached.timestamp ?? 0) > CACHE_TTL_MS) return null;
    return cached;
  }, []);

  const [times, setTimes] = useState<ElapsedTimeRecord[]>(initialCache?.data ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(envError);
  const [lastUpdated, setLastUpdated] = useState<number | null>(initialCache?.timestamp ?? null);
  const [noChanges, setNoChanges] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const reloadTimestampsRef = useRef<number[]>([]);
  const lastReloadRef = useRef(0);
  const inFlightKeyRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const abortReasonRef = useRef<"cleanup" | "new-request" | "unmount" | "timeout">("cleanup");
  const [reloadCooldownMsLeft, setReloadCooldownMsLeft] = useState(0);

  const reload = useCallback(() => {
    const now = Date.now();
    if (now - lastReloadRef.current < RELOAD_COOLDOWN_MS) return;

    // Rate limit: max 5 per minute
    const oneMinuteAgo = now - 60_000;
    const recentReloads = reloadTimestampsRef.current.filter((t) => t > oneMinuteAgo);
    if (recentReloads.length >= MAX_RELOADS_PER_MINUTE) return;

    lastReloadRef.current = now;
    reloadTimestampsRef.current = [...recentReloads, now];

    // Clear latestUpdatedAtMs so next fetch always goes to server
    const periodKey = buildPeriodKey(dateField, period, dateFrom, dateTo);
    const cacheKey = `${CACHE_KEY}:${periodKey}`;
    const cached = storage.get<{ data: ElapsedTimeRecord[]; timestamp: number; latestUpdatedAtMs?: number | null } | null>(cacheKey, null);
    if (cached) {
      storage.set(cacheKey, { ...cached, latestUpdatedAtMs: null });
    }

    setNoChanges(false);
    setRefreshToken((prev) => prev + 1);
  }, [period, dateFrom, dateTo, dateField]);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const left = Math.max(0, RELOAD_COOLDOWN_MS - (now - lastReloadRef.current));
      setReloadCooldownMsLeft(left);
      // prune old entries
      const oneMinuteAgo = now - 60_000;
      reloadTimestampsRef.current = reloadTimestampsRef.current.filter((t) => t > oneMinuteAgo);
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (envError) return;
    if (!endpoint || !latestEndpoint || !key) return;

    const periodKey = buildPeriodKey(dateField, period, dateFrom, dateTo);
    const cacheKey = `${CACHE_KEY}:${periodKey}`;
    const cached = storage.get<{ data: ElapsedTimeRecord[]; timestamp: number; latestUpdatedAtMs?: number | null } | null>(
      cacheKey,
      null
    );
    if (cached?.data?.length) {
      setTimes(cached.data);
      setLastUpdated(cached.timestamp ?? null);
    }

    const requestKey = `${endpoint}|${params.accessToken || key}|${refreshToken}`;
    if (inFlightKeyRef.current === requestKey) return;
    if (abortRef.current) {
      abortReasonRef.current = "new-request";
    }
    const controller = new AbortController();
    let active = true;
    abortRef.current = controller;
    inFlightKeyRef.current = requestKey;
    const timeoutId = window.setTimeout(() => {
      abortReasonRef.current = "timeout";
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    const fetchTimes = async () => {
      // Show loading (but don't hide cached data)
      setLoading(true);
      setError(null);
      setNoChanges(false);
      try {
        const bearer = params.accessToken || key;

        // Read fresh cache state (might have been cleared by reload())
        const cachedForCheck = storage.get<{ data: ElapsedTimeRecord[]; timestamp: number; latestUpdatedAtMs?: number | null } | null>(
          cacheKey,
          null
        );
        const cachedLatestMs = cachedForCheck?.latestUpdatedAtMs ?? null;

        // Only skip fetch if we have latestUpdatedAtMs AND this is auto-refresh (not manual)
        if (typeof cachedLatestMs === "number" && refreshToken === 0) {
          const latestResponse = await fetch(latestEndpoint, {
            headers: {
              apikey: key,
              Authorization: `Bearer ${bearer}`,
            },
            signal: controller.signal,
            cache: "no-store",
          });
          if (latestResponse.ok) {
            const latestRows = (await latestResponse.json()) as {
              updated_at?: string | null;
              inserted_at?: string | null;
              created_date?: string | null;
              date_start?: string | null;
              reference_date?: string | null;
            }[];
            const latestRow = latestRows?.[0] ?? null;
            const parsedUpdated = latestRow?.updated_at ? Date.parse(String(latestRow.updated_at)) : Number.NaN;
            const effectiveDate = getElapsedEffectiveDate(latestRow ?? {});
            const parsedEffective = effectiveDate ? effectiveDate.getTime() : Number.NaN;
            const latestMs = [parsedUpdated, parsedEffective].filter(Number.isFinite).reduce(
              (acc, value) => Math.max(acc, value),
              Number.NaN
            );
            if (!Number.isNaN(latestMs) && latestMs === cachedLatestMs) {
              if (active) {
                setNoChanges(true);
                setTimes(cachedForCheck?.data ?? []);
                setLastUpdated(cachedForCheck?.timestamp ?? null);
              }
              return;
            }
          }
        }

        const fetchPage = async (offset: number) => {
          const separator = endpoint.includes("?") ? "&" : "?";
          const url = `${endpoint}${separator}limit=${PAGE_SIZE}&offset=${offset}`;
          const response = await fetch(url, {
            headers: {
              apikey: key,
              Authorization: `Bearer ${bearer}`,
              Prefer: "count=exact",
            },
            signal: controller.signal,
            cache: "no-store",
          });

          if (!response.ok) {
            const text = await response.text();
            throw new Error(text || `Erro ao buscar tempos (${response.status}).`);
          }

          const range = response.headers.get("Content-Range");
          let totalFromHeader: number | null = null;
          if (range && range.includes("/")) {
            const raw = range.split("/")[1];
            const n = Number(raw);
            if (Number.isFinite(n)) totalFromHeader = n;
          }

          const rows = (await response.json()) as (ElapsedTimeRecord & { minutes?: number })[];
          return { rows, totalFromHeader };
        };

        // Fetch first page to discover total count
        const first = await fetchPage(0);
        let data: ElapsedTimeRecord[] = first.rows.map((row) => ({ ...row, seconds: normalizeSeconds(row) }));

        if (first.rows.length >= PAGE_SIZE && first.totalFromHeader && first.totalFromHeader > PAGE_SIZE) {
          // Fetch remaining pages in parallel
          const remaining = Math.min(Math.ceil(first.totalFromHeader / PAGE_SIZE) - 1, MAX_PAGES - 1);
          const offsets = Array.from({ length: remaining }, (_, i) => (i + 1) * PAGE_SIZE);
          const pages = await Promise.all(offsets.map((o) => fetchPage(o)));
          for (const p of pages) data = data.concat(p.rows.map((row) => ({ ...row, seconds: normalizeSeconds(row) })));
        } else if (first.rows.length >= PAGE_SIZE) {
          // Fallback sequential if no count header
          let offset = PAGE_SIZE;
          for (let page = 1; page < MAX_PAGES; page++) {
            const chunk = await fetchPage(offset);
            data = data.concat(chunk.rows.map((row) => ({ ...row, seconds: normalizeSeconds(row) })));
            if (chunk.rows.length < PAGE_SIZE) break;
            offset += PAGE_SIZE;
          }
        }

        data = filterByEffectivePeriod(data, period, dateFrom, dateTo, dateField);
        if (active) setTimes(data);
        const timestamp = Date.now();
        const latestUpdatedAtMs = data.reduce<number | null>((max, row) => {
          const rawUpdated = row?.updated_at ? String(row.updated_at) : null;
          const parsedUpdated = rawUpdated ? Date.parse(rawUpdated) : Number.NaN;
          const effectiveDate = getElapsedEffectiveDate(row);
          const parsedEffective = effectiveDate ? effectiveDate.getTime() : Number.NaN;
          const parsed = [parsedUpdated, parsedEffective].filter(Number.isFinite).reduce(
            (acc, value) => Math.max(acc, value),
            Number.NaN
          );
          if (Number.isNaN(parsed)) return max;
          if (max === null) return parsed;
          return parsed > max ? parsed : max;
        }, null);
        if (active) setLastUpdated(timestamp);
        storage.set(cacheKey, { data, timestamp, latestUpdatedAtMs });
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        const abortLike =
          controller.signal.aborted ||
          (err instanceof DOMException && err.name === "AbortError") ||
          message.toLowerCase().includes("aborted");
        if (abortLike) {
          if (active) setLoading(false);
          return;
        }
        const messageSafe = message || "Nao foi possivel carregar os tempos.";
        console.error("[elapsed_times] fetch error", { endpoint, message });
        if (active) setError(messageSafe);

        const cachedFallback = storage.get<{ data: ElapsedTimeRecord[]; timestamp: number; latestUpdatedAtMs?: number | null } | null>(
          cacheKey,
          null
        );
        if (active && cachedFallback?.data?.length) {
          setTimes(cachedFallback.data);
          setLastUpdated(cachedFallback.timestamp ?? null);
        }
      } finally {
        if (active && !controller.signal.aborted) {
          setLoading(false);
        }
        inFlightKeyRef.current = null;
        clearTimeout(timeoutId);
      }
    };

    fetchTimes();

    return () => {
      active = false;
      abortReasonRef.current = "unmount";
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      clearTimeout(timeoutId);
      inFlightKeyRef.current = null;
    };
  }, [endpoint, latestEndpoint, key, envError, refreshToken, params.accessToken, period, dateFrom, dateTo, dateField]);

  return { times, loading, error, reload, lastUpdated, reloadCooldownMsLeft, noChanges };
}
