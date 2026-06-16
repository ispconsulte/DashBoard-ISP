import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { storage } from "@/modules/shared/storage";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import type { TaskRecord } from "../types";
import {
  buildElapsedCreatedDateFilter,
  buildTaskDateFilter,
  DEFAULT_TASK_DATE_FILTER_MODE,
  type TaskDateFilterMode,
} from "../taskDateFilter";
import { TASKS_PAGE_ELAPSED_STATE_FILTER, TASKS_PAGE_TASK_STATE_FILTER } from "../taskOperationalFilters";

type UseTasksResult = {
  tasks: TaskRecord[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  lastUpdated: number | null;
  reloadCooldownMsLeft: number;
  /** How many manual reloads remain this minute (out of MAX_RELOADS_PER_MINUTE) */
  reloadsRemainingThisMinute: number;
  noChanges: boolean;
  totalCount: number | null;
};

type UseTasksParams = {
  accessToken?: string | null;
  period?: string;
  dateFrom?: string;
  dateTo?: string;
  dateFilterMode?: TaskDateFilterMode;
  /** When true the hook returns empty defaults and skips all network requests. */
  skip?: boolean;
};

const CACHE_KEY = "cache:tasks:v9";
const RELOAD_COOLDOWN_MS = 12_000; // 5 reloads per minute → 60s / 5 = 12s between
const MAX_RELOADS_PER_MINUTE = 5;
const REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_TASKS_TIMEOUT_MS ?? "25000");
const PAGE_SIZE = 1000;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour — stale cache is ignored on hydration
const MAX_FALLBACK_PAGES = 10;

const buildPeriodKey = (
  dateFilterMode: TaskDateFilterMode,
  period?: string,
  dateFrom?: string,
  dateTo?: string,
) => `${dateFilterMode}:${period === "custom" ? `custom:${dateFrom ?? ""}:${dateTo ?? ""}` : period ?? "all"}`;

const buildEndpoint = (
  period?: string,
  dateFrom?: string,
  dateTo?: string,
  dateFilterMode: TaskDateFilterMode = DEFAULT_TASK_DATE_FILTER_MODE,
) => {
  const url = SUPABASE_URL;
  const key = SUPABASE_ANON_KEY;

  if (!url || !key) {
    return { endpoint: null, latestEndpoint: null, countEndpoint: null, key: null, error: "Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY." };
  }

  const base = url.replace(/\/$/, "");
  const dateFilter = buildTaskDateFilter(dateFilterMode, period, dateFrom, dateTo);
  const select = [
    "task_id",
    "title",
    "description",
    "status",
    "deadline",
    "closed_date",
    ...(dateFilterMode === "created_date" ? ["created_date"] : []),
    "changed_date",
    "time_spent_in_logs",
    "group_id",
    "group_name",
    "responsible_id",
    "responsible_name",
    "project_id",
    "local_state",
    "project_closed",
    "diagnostic_codes",
    "missing_from_bitrix_since",
    "inserted_at",
    "updated_at",
    "projects(name,cliente_id,closed)",
  ].join(",");
  const filterSuffix = dateFilter ? `&${dateFilter}` : "";
  const activeFilter = TASKS_PAGE_TASK_STATE_FILTER;
  const endpoint = `${base}/rest/v1/tasks?select=${encodeURIComponent(select)}&order=deadline.nullslast&${activeFilter}${filterSuffix}`;
  const latestEndpoint = `${base}/rest/v1/tasks?select=updated_at,inserted_at&order=updated_at.desc.nullslast&limit=1&${activeFilter}${filterSuffix}`;
  const countEndpoint = `${base}/rest/v1/tasks?select=task_id&limit=1&${activeFilter}`;
  return { endpoint, latestEndpoint, countEndpoint, key, error: null };
};

export function useTasks(params: UseTasksParams = {}): UseTasksResult {
  const { period = "all", dateFrom, dateTo, dateFilterMode = DEFAULT_TASK_DATE_FILTER_MODE, skip = false } = params;
  const { endpoint, latestEndpoint, countEndpoint, key, error: envError } = useMemo(
    () => buildEndpoint(period, dateFrom, dateTo, dateFilterMode),
    [period, dateFrom, dateTo, dateFilterMode]
  );

  // Hydrate from cache on mount so UI renders instantly (only if within TTL)
  const initialCache = useMemo(() => {
    const periodKey = buildPeriodKey(dateFilterMode, period, dateFrom, dateTo);
    const cached = storage.get<{ data: TaskRecord[]; timestamp: number } | null>(`${CACHE_KEY}:${periodKey}`, null);
    if (!cached?.data?.length) return null;
    if (Date.now() - (cached.timestamp ?? 0) > CACHE_TTL_MS) return null;
    return cached;
  }, [dateFilterMode, period, dateFrom, dateTo]);

  const [tasks, setTasks] = useState<TaskRecord[]>(initialCache?.data ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(envError);
  const [lastUpdated, setLastUpdated] = useState<number | null>(initialCache?.timestamp ?? null);
  const [noChanges, setNoChanges] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  // Rate limiting: track timestamps of last N manual reloads
  const reloadTimestampsRef = useRef<number[]>([]);
  const lastReloadRef = useRef(0);
  const inFlightKeyRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const abortReasonRef = useRef<"cleanup" | "new-request" | "unmount" | "timeout">("cleanup");
  const [reloadCooldownMsLeft, setReloadCooldownMsLeft] = useState(0);
  const [reloadsRemainingThisMinute, setReloadsRemainingThisMinute] = useState(MAX_RELOADS_PER_MINUTE);
  const countCacheRef = useRef<{ timestamp: number; value: number } | null>(null);

  const reload = useCallback(() => {
    const now = Date.now();

    // Enforce per-reload cooldown (prevent double-clicks)
    if (now - lastReloadRef.current < RELOAD_COOLDOWN_MS) return;

    // Enforce rate limit: max 5 per minute
    const oneMinuteAgo = now - 60_000;
    const recentReloads = reloadTimestampsRef.current.filter((t) => t > oneMinuteAgo);
    if (recentReloads.length >= MAX_RELOADS_PER_MINUTE) return;

    // Record this reload
    lastReloadRef.current = now;
    reloadTimestampsRef.current = [...recentReloads, now];

    // Force a new fetch (bypass noChanges check by clearing latestUpdatedAtMs in cache)
    const periodKey = buildPeriodKey(dateFilterMode, period, dateFrom, dateTo);
    const cacheKey = `${CACHE_KEY}:${periodKey}`;
    const cached = storage.get<{ data: TaskRecord[]; timestamp: number; latestUpdatedAtMs?: number | null } | null>(cacheKey, null);
    if (cached) {
      // Clear latestUpdatedAtMs so the next fetch always goes to the server
      storage.set(cacheKey, { ...cached, latestUpdatedAtMs: null });
    }

    setNoChanges(false);
    setRefreshToken((prev) => prev + 1);
  }, [period, dateFrom, dateTo, dateFilterMode]);

  // Update cooldown + remaining count every 250ms
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const left = Math.max(0, RELOAD_COOLDOWN_MS - (now - lastReloadRef.current));
      setReloadCooldownMsLeft(left);

      const oneMinuteAgo = now - 60_000;
      const recentReloads = reloadTimestampsRef.current.filter((t) => t > oneMinuteAgo);
      reloadTimestampsRef.current = recentReloads; // prune old entries
      setReloadsRemainingThisMinute(MAX_RELOADS_PER_MINUTE - recentReloads.length);
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, []);

  // Total count query
  useEffect(() => {
    if (skip) return;
    if (envError) return;
    if (!countEndpoint || !key) return;
    const cached = countCacheRef.current;
    if (cached && Date.now() - cached.timestamp < 60_000) {
      setTotalCount(cached.value);
      return;
    }
    let active = true;
    const controller = new AbortController();
    const bearer = params.accessToken || key;
    fetch(countEndpoint, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${bearer}`,
        Prefer: "count=exact",
      },
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        const range = res.headers.get("Content-Range");
        if (range && range.includes("/")) {
          const totalRaw = range.split("/")[1];
          const total = Number(totalRaw);
          if (Number.isFinite(total)) {
            if (active) {
              setTotalCount(total);
              countCacheRef.current = { timestamp: Date.now(), value: total };
            }
            return;
          }
        }
        const data = (await res.json()) as TaskRecord[];
        const total = Array.isArray(data) ? data.length : 0;
        if (active) {
          setTotalCount(total);
          countCacheRef.current = { timestamp: Date.now(), value: total };
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [skip, countEndpoint, key, envError, params.accessToken]);

  // Main fetch effect
  useEffect(() => {
    if (skip) return;
    if (envError) return;
    if (!endpoint || !latestEndpoint || !key) return;

    const periodKey = buildPeriodKey(dateFilterMode, period, dateFrom, dateTo);
    const cacheKey = `${CACHE_KEY}:${periodKey}`;
    const cached = storage.get<{ data: TaskRecord[]; timestamp: number; latestUpdatedAtMs?: number | null } | null>(
      cacheKey,
      null
    );
    if (cached?.data?.length) {
      setTasks(cached.data);
      setLastUpdated(cached.timestamp ?? null);
    }

    // Build a unique key that changes with refreshToken so each manual reload triggers a new fetch
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

    const fetchTasks = async () => {
      // Only show full loading state if we have no cached data; otherwise keep
      // the stale data visible while refreshing in the background.
      const hasCachedData = Boolean(cached?.data?.length);
      if (!hasCachedData) setLoading(true);
      setError(null);
      setNoChanges(false);
      try {
        const bearer = params.accessToken || key;

        // Read fresh cache state (might have been cleared by reload())
        const cachedForCheck = storage.get<{ data: TaskRecord[]; timestamp: number; latestUpdatedAtMs?: number | null } | null>(
          cacheKey,
          null
        );
        const cachedLatestMs = cachedForCheck?.latestUpdatedAtMs ?? null;

        // Tempo gasto depends on elapsed rows, so do not trust the task-only latest shortcut.
        if (typeof cachedLatestMs === "number" && refreshToken === 0 && dateFilterMode !== "elapsed_created_date") {
          // auto-fetch on mount: check if anything changed before pulling all rows
          const latestResponse = await fetch(latestEndpoint, {
            headers: {
              apikey: key,
              Authorization: `Bearer ${bearer}`,
            },
            signal: controller.signal,
            cache: "no-store",
          });
          if (latestResponse.ok) {
            const latestRows = (await latestResponse.json()) as { updated_at?: string | null; inserted_at?: string | null }[];
            const latestRow = latestRows?.[0] ?? null;
            const latestUpdated = latestRow?.updated_at ?? null;
            const latestInserted = latestRow?.inserted_at ?? null;
            const parsedUpdated = latestUpdated ? Date.parse(String(latestUpdated)) : Number.NaN;
            const parsedInserted = latestInserted ? Date.parse(String(latestInserted)) : Number.NaN;
            const latestMs = [parsedUpdated, parsedInserted].filter(Number.isFinite).reduce(
              (acc, value) => Math.max(acc, value),
              Number.NaN
            );
            if (!Number.isNaN(latestMs) && latestMs === cachedLatestMs) {
              if (active) {
                setNoChanges(true);
                setTasks(cachedForCheck?.data ?? []);
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
            // Detect JWT/auth errors and provide friendly message
            const lower = text.toLowerCase();
            if (
              response.status === 401 || response.status === 403 ||
              lower.includes("jwt expired") || lower.includes("jwt") ||
              lower.includes("pgrst301") || lower.includes("pgrst303")
            ) {
              throw new Error("__JWT_EXPIRED__");
            }
            throw new Error(text || `Erro ao buscar tarefas (${response.status}).`);
          }

          const range = response.headers.get("Content-Range");
          let totalFromHeader: number | null = null;
          if (range && range.includes("/")) {
            const raw = range.split("/")[1];
            const n = Number(raw);
            if (Number.isFinite(n)) totalFromHeader = n;
          }

          const rows = (await response.json()) as TaskRecord[];
          return { rows, totalFromHeader };
        };

        const fetchElapsedTaskIds = async () => {
          const elapsedFilter = buildElapsedCreatedDateFilter(period, dateFrom, dateTo);
          const base = SUPABASE_URL.replace(/\/$/, "");
          const select = encodeURIComponent("task_id");
          const suffix = elapsedFilter ? `&${elapsedFilter}` : "";
          const activeFilter = TASKS_PAGE_ELAPSED_STATE_FILTER;
          const elapsedEndpoint = `${base}/rest/v1/elapsed_times?select=${select}&${activeFilter}${suffix}`;
          const taskIds = new Set<string>();

          const fetchElapsedPage = async (offset: number) => {
            const url = `${elapsedEndpoint}&limit=${PAGE_SIZE}&offset=${offset}`;
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
              throw new Error(text || `Erro ao buscar tempos por tarefa (${response.status}).`);
            }

            const range = response.headers.get("Content-Range");
            const totalRaw = range?.includes("/") ? range.split("/")[1] : null;
            const totalFromHeader = totalRaw && Number.isFinite(Number(totalRaw)) ? Number(totalRaw) : null;
            const rows = (await response.json()) as Array<{ task_id?: string | number | null }>;
            return { rows, totalFromHeader };
          };

          const firstElapsed = await fetchElapsedPage(0);
          firstElapsed.rows.forEach((row) => {
            if (row.task_id !== undefined && row.task_id !== null) taskIds.add(String(row.task_id));
          });

          if (firstElapsed.rows.length >= PAGE_SIZE && firstElapsed.totalFromHeader && firstElapsed.totalFromHeader > PAGE_SIZE) {
            const remaining = Math.ceil(firstElapsed.totalFromHeader / PAGE_SIZE) - 1;
            const offsets = Array.from({ length: remaining }, (_, i) => (i + 1) * PAGE_SIZE);
            const pages = await Promise.all(offsets.map((o) => fetchElapsedPage(o)));
            pages.forEach((page) => {
              page.rows.forEach((row) => {
                if (row.task_id !== undefined && row.task_id !== null) taskIds.add(String(row.task_id));
              });
            });
          } else if (firstElapsed.rows.length >= PAGE_SIZE) {
            let offset = PAGE_SIZE;
            for (let page = 1; page < MAX_FALLBACK_PAGES; page++) {
              const chunk = await fetchElapsedPage(offset);
              chunk.rows.forEach((row) => {
                if (row.task_id !== undefined && row.task_id !== null) taskIds.add(String(row.task_id));
              });
              if (chunk.rows.length < PAGE_SIZE) break;
              offset += PAGE_SIZE;
            }
          }

          return taskIds;
        };

        // Fetch first page to discover total count
        const first = await fetchPage(0);
        let data: TaskRecord[] = first.rows;

        if (first.rows.length >= PAGE_SIZE && first.totalFromHeader && first.totalFromHeader > PAGE_SIZE) {
          // Fetch remaining pages in parallel
          const remaining = Math.ceil(first.totalFromHeader / PAGE_SIZE) - 1;
          const offsets = Array.from({ length: remaining }, (_, i) => (i + 1) * PAGE_SIZE);
          const pages = await Promise.all(offsets.map((o) => fetchPage(o)));
          for (const p of pages) data = data.concat(p.rows);
        } else if (first.rows.length >= PAGE_SIZE) {
          // Fallback sequential if no count header
          let offset = PAGE_SIZE;
          for (let page = 1; page < MAX_FALLBACK_PAGES; page++) {
            const chunk = await fetchPage(offset);
            data = data.concat(chunk.rows);
            if (chunk.rows.length < PAGE_SIZE) break;
            offset += PAGE_SIZE;
          }
        }

        const elapsedTaskIds = dateFilterMode === "elapsed_created_date"
          ? await fetchElapsedTaskIds()
          : null;
        const filteredData = elapsedTaskIds
          ? data.filter((row) => {
              const id = row.task_id ?? row.id;
              return id !== undefined && id !== null && elapsedTaskIds.has(String(id));
            })
          : data;

        const timestamp = Date.now();
        const latestUpdatedAtMs = filteredData.reduce<number | null>((max, row) => {
          const rawUpdated = row?.updated_at ? String(row.updated_at) : null;
          const rawInserted = row?.inserted_at ? String(row.inserted_at) : null;
          const parsedUpdated = rawUpdated ? Date.parse(rawUpdated) : Number.NaN;
          const parsedInserted = rawInserted ? Date.parse(rawInserted) : Number.NaN;
          const parsed = [parsedUpdated, parsedInserted].filter(Number.isFinite).reduce(
            (acc, value) => Math.max(acc, value),
            Number.NaN
          );
          if (Number.isNaN(parsed)) return max;
          if (max === null) return parsed;
          return parsed > max ? parsed : max;
        }, null);

        if (!filteredData.length && cached?.data?.length) {
          // Comportamento esperado (resiliencia): API retornou vazio mas ha cache
          // valido, entao reaproveitamos o cache. Usamos info para nao parecer erro.
          console.info("[tasks] vazio da API, usando cache como fallback");
          if (active) {
            setTasks(cached.data);
            setLastUpdated(cached.timestamp ?? timestamp);
            setTotalCount(cached.data.length);
          }
        } else {
          if (active) {
            setTasks(filteredData);
            setLastUpdated(timestamp);
            setTotalCount(filteredData.length);
          }
          storage.set(cacheKey, { data: filteredData, timestamp, latestUpdatedAtMs });
        }
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
        // JWT expired: show friendly message
        if (message === "__JWT_EXPIRED__") {
          console.warn("[tasks] JWT expired — session needs refresh");
          if (active) setError("Sua sessão expirou. Por favor, faça login novamente para continuar.");
        } else {
          const messageSafe = message || "Não foi possível carregar as tarefas.";
          console.error("[tasks] fetch error", { endpoint, message });
          if (active) setError(messageSafe);
        }

        const cachedFallback = storage.get<{ data: TaskRecord[]; timestamp: number; latestUpdatedAtMs?: number | null } | null>(
          cacheKey,
          null
        );
        if (active && cachedFallback?.data?.length) {
          setTasks(cachedFallback.data);
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

    fetchTasks();

    return () => {
      active = false;
      abortReasonRef.current = "unmount";
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      clearTimeout(timeoutId);
      inFlightKeyRef.current = null;
    };
  }, [skip, endpoint, latestEndpoint, key, envError, refreshToken, params.accessToken, period, dateFrom, dateTo, dateFilterMode]);

  return { tasks, loading, error, reload, lastUpdated, reloadCooldownMsLeft, reloadsRemainingThisMinute, noChanges, totalCount };
}
