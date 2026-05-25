import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { getTaskTimeSpentSeconds } from "@/modules/tasks/utils";

type ProjectHoursRow = {
  task_id: string | number;
  project_id: number | string | null;
  group_name: string | null;
  time_spent_in_logs: number | string | null;
  projects?: {
    name?: string | null;
    cliente_id?: number | string | null;
  } | null;
};

type ClientRow = {
  cliente_id: number | string;
  nome: string | null;
};

export type ProjectHours = {
  projectId: number;
  projectName: string;
  clientId: number;
  clientName: string;
  hours: number;
  seconds: number;
};

type UseProjectHoursParams = {
  startIso: string;
  endIso: string;
  clientId?: number | null;
  projectId?: number | null;
};

type UseProjectHoursResult = {
  data: ProjectHours[];
  loading: boolean;
  error: string | null;
  reload: () => void;
};

const buildRpcEndpoint = () => {
  const url = SUPABASE_URL;
  const key = SUPABASE_ANON_KEY;
  if (!url || !key) {
    return { endpoint: null, key: null, error: "Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY." };
  }
  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/tasks`;
  return { endpoint, key, error: null };
};

export function useProjectHours(params: UseProjectHoursParams): UseProjectHoursResult {
  const AUTO_REFRESH_MS = 5 * 60 * 1000;
  const { startIso, endIso, clientId = null, projectId = null } = params;
  const [{ endpoint, key, error: envError }] = useState(buildRpcEndpoint);
  const [data, setData] = useState<ProjectHours[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(envError);
  const [refreshFlag, setRefreshFlag] = useState(0);
  const cacheRef = useRef(new Map<string, { timestamp: number; data: ProjectHours[] }>());
  const lastReloadRef = useRef(0);
  const cacheKey = `${startIso}|${endIso}|${clientId ?? "all"}|${projectId ?? "all"}`;
  const CACHE_TTL_MS = 5 * 60 * 1000;
  const RELOAD_COOLDOWN_MS = 5000;

  const reload = useCallback(() => {
    const now = Date.now();
    if (now - lastReloadRef.current < RELOAD_COOLDOWN_MS) return;
    lastReloadRef.current = now;
    setRefreshFlag((prev) => prev + 1);
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setRefreshFlag((prev) => prev + 1);
    }, AUTO_REFRESH_MS);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        setRefreshFlag((prev) => prev + 1);
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
    if (envError) return;
    if (!endpoint || !key) return;
    if (!startIso || !endIso) return;

    const cached = cacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS && refreshFlag === 0) {
      setData(cached.data);
      return;
    }

    const controller = new AbortController();
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const select = [
          "task_id",
          "project_id",
          "group_name",
          "time_spent_in_logs",
          "projects(name,cliente_id)",
        ].join(",");
        const pageSize = 1000;
        const rows: ProjectHoursRow[] = [];

        for (let offset = 0; offset < 10000; offset += pageSize) {
          const params = new URLSearchParams({
            select,
            local_state: "eq.active",
            diagnostic_codes: "eq.{}",
            changed_date: `gte.${startIso}`,
            order: "project_id.asc.nullslast",
            limit: String(pageSize),
            offset: String(offset),
          });
          params.append("changed_date", `lte.${endIso}`);
          if (projectId) params.append("project_id", `eq.${projectId}`);

          const response = await fetch(`${endpoint}?${params.toString()}`, {
            headers: {
              apikey: key,
              Authorization: `Bearer ${key}`,
            },
            signal: controller.signal,
          });

          if (!response.ok) {
            const text = await response.text();
            throw new Error(text || `Erro ao buscar horas (status ${response.status}).`);
          }

          const pageRows = (await response.json()) as ProjectHoursRow[];
          rows.push(...pageRows);
          if (pageRows.length < pageSize) break;
        }

        const clientIds = Array.from(
          new Set(
            rows
              .map((row) => Number(row.projects?.cliente_id ?? 0))
              .filter((value) => Number.isFinite(value) && value > 0),
          ),
        );
        const clientNameById = new Map<number, string>();

        for (let offset = 0; offset < clientIds.length; offset += 200) {
          const slice = clientIds.slice(offset, offset + 200);
          if (!slice.length) continue;
          const clientResponse = await fetch(
            `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/clientes?select=cliente_id,nome&cliente_id=in.(${slice.join(",")})`,
            {
              headers: {
                apikey: key,
                Authorization: `Bearer ${key}`,
              },
              signal: controller.signal,
            },
          );
          if (!clientResponse.ok) continue;
          const clientRows = (await clientResponse.json()) as ClientRow[];
          clientRows.forEach((row) => {
            const id = Number(row.cliente_id);
            if (id && row.nome) clientNameById.set(id, row.nome);
          });
        }

        const totals = new Map<number, ProjectHours>();
        rows.forEach((row) => {
          const seconds = getTaskTimeSpentSeconds(row as unknown as Record<string, unknown>) ?? 0;
          if (seconds <= 0) return;

          const resolvedProjectId = Number(row.project_id ?? 0);
          if (!resolvedProjectId) return;

          const resolvedClientId = Number(row.projects?.cliente_id ?? 0);
          if (clientId && resolvedClientId !== clientId) return;

          const current = totals.get(resolvedProjectId) ?? {
            projectId: resolvedProjectId,
            projectName: String(row.projects?.name ?? row.group_name ?? `Projeto #${resolvedProjectId}`),
            clientId: resolvedClientId,
            clientName: resolvedClientId ? clientNameById.get(resolvedClientId) ?? "" : "",
            hours: 0,
            seconds: 0,
          };

          current.seconds += seconds;
          current.hours = Math.round((current.seconds / 3600) * 100) / 100;
          if (!current.clientName && resolvedClientId) {
            current.clientName = clientNameById.get(resolvedClientId) ?? "";
          }
          totals.set(resolvedProjectId, current);
        });

        const mapped = Array.from(totals.values()).sort((a, b) => b.seconds - a.seconds);
        setData(mapped);
        cacheRef.current.set(cacheKey, { timestamp: Date.now(), data: mapped });
      } catch (err) {
        if (controller.signal.aborted || (err instanceof Error && err.name === "AbortError")) return;
        const message = (err as Error).message || "Não foi possível carregar as horas.";
        console.error("[useProjectHours] fetch error", message);
        setError(message);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchData().catch(() => {});
    return () => controller.abort();
  }, [endpoint, key, envError, startIso, endIso, clientId, projectId, refreshFlag]);

  const normalized = useMemo(
    () => data.filter((d) => Number.isFinite(d.hours) && d.projectName),
    [data]
  );

  return { data: normalized, loading, error, reload };
}
