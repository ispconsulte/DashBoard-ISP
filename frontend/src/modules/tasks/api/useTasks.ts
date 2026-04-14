import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { storage } from "@/modules/shared/storage";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { shouldShowTaskInOperations } from "../diagnostics";
import type { TaskRecord } from "../types";

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
  /** When true the hook returns empty defaults and skips all network requests. */
  skip?: boolean;
};

const CACHE_KEY = "cache:tasks:v4";
const RELOAD_COOLDOWN_MS = 12_000; // 5 reloads per minute → 60s / 5 = 12s between
const MAX_RELOADS_PER_MINUTE = 5;
const REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_TASKS_TIMEOUT_MS ?? "25000");
const PAGE_SIZE = 1000;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour — stale cache is ignored on hydration
const MAX_PAGES = 10;

async function fetchTaskDiagnosticControls(
  baseUrl: string,
  key: string,
  bearer: string,
  signal: AbortSignal,
) {
  const response = await fetch(
    `${baseUrl}/rest/v1/task_diagnostic_controls?select=task_id,visibility_mode`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${bearer}`,
      },
      signal,
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return new Map<number, string>();
  }

  const rows = (await response.json()) as Array<{ task_id?: number | string; visibility_mode?: string | null }>;
  return new Map(
    rows
      .map((row) => [Number(row.task_id), row.visibility_mode ?? null] as const)
      .filter(([taskId]) => Number.isFinite(taskId) && taskId > 0),
  );
}

const buildDateFilter = (period?: string, dateFrom?: string, dateTo?: string) => {
  const now = new Date();
  if (period && period !== "all" && period !== "custom") {
    const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 180;
    const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const iso = encodeURIComponent(from.toISOString());
    // Considera criacao, atualizacao e prazo para nao esconder tarefas antigas ainda relevantes.
    return `or=(inserted_at.gte.${iso},updated_at.gte.${iso},deadline.gte.${iso})`;
  }
  if (period === "custom") {
    const parts: string[] = [];
    if (dateFrom) {
      const from = new Date(dateFrom);
      if (!Number.isNaN(from.getTime())) {
        const iso = encodeURIComponent(from.toISOString());
        parts.push(`or(inserted_at.gte.${iso},updated_at.gte.${iso},deadline.gte.${iso})`);
      }
    }
    if (dateTo) {
      const to = new Date(dateTo);
      if (!Number.isNaN(to.getTime())) {
        const iso = encodeURIComponent(to.toISOString());
        parts.push(`or(inserted_at.lte.${iso},updated_at.lte.${iso},deadline.lte.${iso})`);
      }
    }
    if (parts.length === 2) return `and=(${parts.join(",")})`;
    if (parts.length === 1) {
      const single = parts[0];
      return single.startsWith("or(") ? `or=${single.slice(2)}` : single;
    }
    return "";
  }
  return "";
};

const buildEndpoint = (period?: string, dateFrom?: string, dateTo?: string) => {
  const url = SUPABASE_URL;
  const key = SUPABASE_ANON_KEY;

  if (!url || !key) {
    return { endpoint: null, latestEndpoint: null, countEndpoint: null, key: null, error: "Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY." };
  }

  const base = url.replace(/\/$/, "");
  const dateFilter = buildDateFilter(period, dateFrom, dateTo);
  const select = [
    "task_id",
    "title",
    "description",
    "status",
    "deadline",
    "closed_date",
    "group_id",
    "group_name",
    "responsible_id",
    "responsible_name",
    "project_id",
    "missing_from_bitrix_since",
    "inserted_at",
    "updated_at",
    "projects(name,cliente_id)",
  ].join(",");
  const filterSuffix = dateFilter ? `&${dateFilter}` : "";
  const activeFilter = "missing_from_bitrix_since=is.null";
  const endpoint = `${base}/rest/v1/tasks?select=${encodeURIComponent(select)}&order=deadline.nullslast&${activeFilter}${filterSuffix}`;
  const latestEndpoint = `${base}/rest/v1/tasks?select=updated_at,inserted_at&order=updated_at.desc.nullslast&limit=1&${activeFilter}${filterSuffix}`;
  const countEndpoint = `${base}/rest/v1/tasks?select=task_id&limit=1&${activeFilter}`;
  return { endpoint, latestEndpoint, countEndpoint, key, error: null };
};

export function useTasks(params: UseTasksParams = {}): UseTasksResult {
  const { period = "all", dateFrom, dateTo, skip = false } = params;
  const { endpoint, latestEndpoint, countEndpoint, key, error: envError } = useMemo(
    () => buildEndpoint(period, dateFrom, dateTo),
    [period, dateFrom, dateTo]
  );

  // Hydrate from cache on mount so UI renders instantly (only if within TTL)
  const initialCache = useMemo(() => {
    const periodKey = period === "custom" ? `custom:${dateFrom ?? ""}:${dateTo ?? ""}` : period;
    const cached = storage.get<{ data: TaskRecord[]; timestamp: number } | null>(`${CACHE_KEY}:${periodKey}`, null);
    if (!cached?.data?.length) return null;
    if (Date.now() - (cached.timestamp ?? 0) > CACHE_TTL_MS) return null;
    return cached;
  }, []); // intentionally empty — only read cache on first mount

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
    const periodKey = period === "custom" ? `custom:${dateFrom ?? ""}:${dateTo ?? ""}` : period;
    const cacheKey = `${CACHE_KEY}:${periodKey}`;
    const cached = storage.get<{ data: TaskRecord[]; timestamp: number; latestUpdatedAtMs?: number | null } | null>(cacheKey, null);
    if (cached) {
      // Clear latestUpdatedAtMs so the next fetch always goes to the server
      storage.set(cacheKey, { ...cached, latestUpdatedAtMs: null });
    }

    setNoChanges(false);
    setRefreshToken((prev) => prev + 1);
  }, [period, dateFrom, dateTo]);

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
            setTotalCount(total);
            countCacheRef.current = { timestamp: Date.now(), value: total };
            return;
          }
        }
        const data = (await res.json()) as TaskRecord[];
        const total = Array.isArray(data) ? data.length : 0;
        setTotalCount(total);
        countCacheRef.current = { timestamp: Date.now(), value: total };
      })
      .catch(() => {});
    return () => controller.abort();
  }, [skip, countEndpoint, key, envError, params.accessToken]);

  // Main fetch effect
  useEffect(() => {
    if (skip) return;
    if (envError) return;
    if (!endpoint || !latestEndpoint || !key) return;

    const periodKey = period === "custom" ? `custom:${dateFrom ?? ""}:${dateTo ?? ""}` : period;
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
      abortRef.current.abort();
    }
    const controller = new AbortController();
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
        const baseUrl = SUPABASE_URL.replace(/\/$/, "");

        // Read fresh cache state (might have been cleared by reload())
        const cachedForCheck = storage.get<{ data: TaskRecord[]; timestamp: number; latestUpdatedAtMs?: number | null } | null>(
          cacheKey,
          null
        );
        const cachedLatestMs = cachedForCheck?.latestUpdatedAtMs ?? null;

        // Only skip fetch if we have a valid latestUpdatedAtMs AND this is not a manual reload
        if (typeof cachedLatestMs === "number" && refreshToken === 0) {
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
              setNoChanges(true);
              setTasks(cachedForCheck?.data ?? []);
              setLastUpdated(cachedForCheck?.timestamp ?? null);
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

        // Fetch first page to discover total count
        const first = await fetchPage(0);
        let data: TaskRecord[] = first.rows;

        if (first.rows.length >= PAGE_SIZE && first.totalFromHeader && first.totalFromHeader > PAGE_SIZE) {
          // Fetch remaining pages in parallel
          const remaining = Math.min(Math.ceil(first.totalFromHeader / PAGE_SIZE) - 1, MAX_PAGES - 1);
          const offsets = Array.from({ length: remaining }, (_, i) => (i + 1) * PAGE_SIZE);
          const pages = await Promise.all(offsets.map((o) => fetchPage(o)));
          for (const p of pages) data = data.concat(p.rows);
        } else if (first.rows.length >= PAGE_SIZE) {
          // Fallback sequential if no count header
          let offset = PAGE_SIZE;
          for (let page = 1; page < MAX_PAGES; page++) {
            const chunk = await fetchPage(offset);
            data = data.concat(chunk.rows);
            if (chunk.rows.length < PAGE_SIZE) break;
            offset += PAGE_SIZE;
          }
        }

        const controls = await fetchTaskDiagnosticControls(baseUrl, key, bearer, controller.signal);
        const filteredData = data.filter((task) =>
          shouldShowTaskInOperations(task, controls.get(Number(task.task_id ?? task.id ?? 0))),
        );

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
          console.warn("[tasks] vazio da API, usando cache como fallback");
          setTasks(cached.data);
          setLastUpdated(cached.timestamp ?? timestamp);
          setTotalCount(cached.data.length);
        } else {
          setTasks(filteredData);
          setLastUpdated(timestamp);
          setTotalCount(filteredData.length);
          storage.set(cacheKey, { data: filteredData, timestamp, latestUpdatedAtMs });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        const abortLike =
          controller.signal.aborted ||
          (err instanceof DOMException && err.name === "AbortError") ||
          message.toLowerCase().includes("aborted");
        if (abortLike) {
          setLoading(false);
          return;
        }
        // JWT expired: show friendly message
        if (message === "__JWT_EXPIRED__") {
          console.warn("[tasks] JWT expired — session needs refresh");
          setError("Sua sessão expirou. Por favor, faça login novamente para continuar.");
        } else {
          const messageSafe = message || "Não foi possível carregar as tarefas.";
          console.error("[tasks] fetch error", { endpoint, message });
          setError(messageSafe);
        }

        const cachedFallback = storage.get<{ data: TaskRecord[]; timestamp: number; latestUpdatedAtMs?: number | null } | null>(
          cacheKey,
          null
        );
        if (cachedFallback?.data?.length) {
          setTasks(cachedFallback.data);
          setLastUpdated(cachedFallback.timestamp ?? null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
        inFlightKeyRef.current = null;
        clearTimeout(timeoutId);
      }
    };

    fetchTasks();

    return () => {
      abortReasonRef.current = "unmount";
      controller.abort();
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      clearTimeout(timeoutId);
      inFlightKeyRef.current = null;
    };
  }, [skip, endpoint, latestEndpoint, key, envError, refreshToken, params.accessToken, period, dateFrom, dateTo]);

  return { tasks, loading, error, reload, lastUpdated, reloadCooldownMsLeft, reloadsRemainingThisMinute, noChanges, totalCount };
}
