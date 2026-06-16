import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import {
  buildProjectHoursFromElapsedRows,
  type ProjectHoursElapsedRow,
  type ProjectHoursTaskRow,
} from "./projectHoursAggregation";

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
  elapsedSeconds: number;
  diffSeconds: number;
  hasHourMismatch: boolean;
};

export type TaskHoursMismatch = {
  taskId: string;
  title: string;
  projectId: number;
  projectName: string;
  responsibleName: string;
  timeSpentSeconds: number;
  elapsedSeconds: number;
  diffSeconds: number;
};

type UseProjectHoursParams = {
  startIso: string;
  endIso: string;
  clientId?: number | null;
  projectId?: number | null;
  userId?: number | null;
};

type UseProjectHoursResult = {
  data: ProjectHours[];
  mismatches: TaskHoursMismatch[];
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
  const endpoint = `${url.replace(/\/$/, "")}/rest/v1`;
  return { endpoint, key, error: null };
};

const AUTO_REFRESH_MS = 5 * 60 * 1000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const RELOAD_COOLDOWN_MS = 5000;

export function useProjectHours(params: UseProjectHoursParams): UseProjectHoursResult {
  const { startIso, endIso, clientId = null, projectId = null, userId = null } = params;
  const [{ endpoint, key, error: envError }] = useState(buildRpcEndpoint);
  const [data, setData] = useState<ProjectHours[]>([]);
  const [mismatches, setMismatches] = useState<TaskHoursMismatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(envError);
  const [refreshFlag, setRefreshFlag] = useState(0);
  const cacheRef = useRef(new Map<string, { timestamp: number; data: ProjectHours[]; mismatches: TaskHoursMismatch[] }>());
  const lastReloadRef = useRef(0);
  const cacheKey = useMemo(
    () => `${startIso}|${endIso}|${clientId ?? "all"}|${projectId ?? "all"}|${userId ?? "all"}`,
    [startIso, endIso, clientId, projectId, userId],
  );

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
      setMismatches(cached.mismatches);
      return;
    }

    let active = true;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const elapsedSelect = [
          "task_id",
          "user_id",
          "seconds",
          "reference_date",
          "date_start",
          "created_date",
        ].join(",");
        const taskSelect = [
          "task_id",
          "title",
          "responsible_name",
          "project_id",
          "group_name",
          "time_spent_in_logs",
          "projects(name,cliente_id)",
        ].join(",");
        const pageSize = 1000;
        const elapsedRows: ProjectHoursElapsedRow[] = [];

        for (let offset = 0; offset < 10000; offset += pageSize) {
          const elapsedParams = new URLSearchParams({
            select: elapsedSelect,
            local_state: "eq.active",
            reference_date: `gte.${startIso}`,
            order: "reference_date.asc",
            limit: String(pageSize),
            offset: String(offset),
          });
          elapsedParams.append("reference_date", `lte.${endIso}`);
          if (userId) elapsedParams.append("user_id", `eq.${userId}`);

          const response = await fetch(`${endpoint}/operational_elapsed_times?${elapsedParams.toString()}`, {
            headers: {
              apikey: key,
              Authorization: `Bearer ${key}`,
            },
          });

          if (!response.ok) {
            const text = await response.text();
            throw new Error(text || `Erro ao buscar horas (status ${response.status}).`);
          }

          const pageRows = (await response.json()) as ProjectHoursElapsedRow[];
          elapsedRows.push(...pageRows);
          if (pageRows.length < pageSize) break;
        }

        const taskIds = Array.from(new Set(elapsedRows.map((row) => String(row.task_id ?? "")).filter(Boolean)));
        const rows: ProjectHoursTaskRow[] = [];

        for (let start = 0; start < taskIds.length; start += 150) {
          const slice = taskIds.slice(start, start + 150);
          if (!slice.length) continue;
          const taskParams = new URLSearchParams({
            select: taskSelect,
            local_state: "eq.active",
            diagnostic_codes: "eq.{}",
            task_id: `in.(${slice.join(",")})`,
            order: "project_id.asc.nullslast",
            limit: String(pageSize),
          });
          if (projectId) taskParams.append("project_id", `eq.${projectId}`);

          const response = await fetch(`${endpoint}/tasks?${taskParams.toString()}`, {
            headers: {
              apikey: key,
              Authorization: `Bearer ${key}`,
            },
          });

          if (!response.ok) {
            const text = await response.text();
            throw new Error(text || `Erro ao buscar dimensões das tarefas (status ${response.status}).`);
          }

          rows.push(...((await response.json()) as ProjectHoursTaskRow[]));
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
            `${endpoint}/clientes?select=cliente_id,nome&cliente_id=in.(${slice.join(",")})`,
            {
              headers: {
                apikey: key,
                Authorization: `Bearer ${key}`,
              },
            },
          );
          if (!clientResponse.ok) continue;
          const clientRows = (await clientResponse.json()) as ClientRow[];
          clientRows.forEach((row) => {
            const id = Number(row.cliente_id);
            if (id && row.nome) clientNameById.set(id, row.nome);
          });
        }

        const { data: mapped, mismatches: taskMismatches } = buildProjectHoursFromElapsedRows({
          elapsedRows,
          taskRows: rows,
          clientNameById,
          startIso,
          endIso,
          clientId,
          projectId,
          userId,
        });

        if (!active) return;
        setData(mapped);
        setMismatches(taskMismatches);
        cacheRef.current.set(cacheKey, { timestamp: Date.now(), data: mapped, mismatches: taskMismatches });
      } catch (err) {
        if (!active || (err instanceof Error && err.name === "AbortError")) return;
        const message = (err as Error).message || "Não foi possível carregar as horas.";
        console.error("[useProjectHours] fetch error", message);
        setError(message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchData().catch(() => {});
    return () => {
      active = false;
    };
  }, [endpoint, key, envError, startIso, endIso, clientId, projectId, userId, refreshFlag, cacheKey]);

  const normalized = useMemo(
    () => data.filter((d) => Number.isFinite(d.hours) && d.projectName),
    [data]
  );

  return { data: normalized, mismatches, loading, error, reload };
}
