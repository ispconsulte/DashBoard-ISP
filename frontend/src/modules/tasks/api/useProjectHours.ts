import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { getTaskTimeSpentSeconds } from "@/modules/tasks/utils";

type ProjectHoursRow = {
  task_id: string | number;
  title?: string | null;
  responsible_name?: string | null;
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

type ElapsedTimeRow = {
  task_id: string | number | null;
  seconds: number | string | null;
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
  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/tasks`;
  return { endpoint, key, error: null };
};

export function useProjectHours(params: UseProjectHoursParams): UseProjectHoursResult {
  const AUTO_REFRESH_MS = 5 * 60 * 1000;
  const { startIso, endIso, clientId = null, projectId = null } = params;
  const [{ endpoint, key, error: envError }] = useState(buildRpcEndpoint);
  const [data, setData] = useState<ProjectHours[]>([]);
  const [mismatches, setMismatches] = useState<TaskHoursMismatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(envError);
  const [refreshFlag, setRefreshFlag] = useState(0);
  const cacheRef = useRef(new Map<string, { timestamp: number; data: ProjectHours[]; mismatches: TaskHoursMismatch[] }>());
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
      setMismatches(cached.mismatches);
      return;
    }

    const controller = new AbortController();
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const select = [
          "task_id",
          "title",
          "responsible_name",
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
        const taskProjectById = new Map<string | number, number>();

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

        const scopedRows = rows.filter((row) => {
          const resolvedProjectId = Number(row.project_id ?? 0);
          if (!resolvedProjectId) return false;

          if (projectId && resolvedProjectId !== projectId) return false;
          const resolvedClientId = Number(row.projects?.cliente_id ?? 0);
          if (clientId && resolvedClientId !== clientId) return false;

          taskProjectById.set(row.task_id, resolvedProjectId);
          taskProjectById.set(String(row.task_id), resolvedProjectId);
          return true;
        });

        const totals = new Map<number, ProjectHours>();
        scopedRows.forEach((row) => {
          const seconds = getTaskTimeSpentSeconds(row as unknown as Record<string, unknown>) ?? 0;
          if (seconds <= 0) return;

          const resolvedProjectId = Number(row.project_id ?? 0);
          const resolvedClientId = Number(row.projects?.cliente_id ?? 0);
          const current = totals.get(resolvedProjectId) ?? {
            projectId: resolvedProjectId,
            projectName: String(row.projects?.name ?? row.group_name ?? `Projeto #${resolvedProjectId}`),
            clientId: resolvedClientId,
            clientName: resolvedClientId ? clientNameById.get(resolvedClientId) ?? "" : "",
            hours: 0,
            seconds: 0,
            elapsedSeconds: 0,
            diffSeconds: 0,
            hasHourMismatch: false,
          };

          current.seconds += seconds;
          current.hours = Math.round((current.seconds / 3600) * 100) / 100;
          if (!current.clientName && resolvedClientId) {
            current.clientName = clientNameById.get(resolvedClientId) ?? "";
          }
          totals.set(resolvedProjectId, current);
        });

        const taskIds = Array.from(new Set(scopedRows.map((row) => String(row.task_id ?? "")).filter(Boolean)));
        const elapsedByTaskId = new Map<string, number>();
        const elapsedByProject = new Map<number, number>();
        const baseUrl = SUPABASE_URL.replace(/\/$/, "");
        for (let start = 0; start < taskIds.length; start += 150) {
          const slice = taskIds.slice(start, start + 150);
          if (!slice.length) continue;
          for (let offset = 0; offset < 10000; offset += pageSize) {
            const elapsedParams = new URLSearchParams({
              select: "task_id,seconds",
              local_state: "eq.active",
              task_id: `in.(${slice.join(",")})`,
              limit: String(pageSize),
              offset: String(offset),
            });
            const elapsedResponse = await fetch(`${baseUrl}/rest/v1/operational_elapsed_times?${elapsedParams.toString()}`, {
              headers: {
                apikey: key,
                Authorization: `Bearer ${key}`,
              },
              signal: controller.signal,
            });
            if (!elapsedResponse.ok) break;
            const elapsedRows = (await elapsedResponse.json()) as ElapsedTimeRow[];
            elapsedRows.forEach((row) => {
              const taskId = row.task_id;
              if (!taskId) return;
              const projectKey = taskProjectById.get(taskId) ?? taskProjectById.get(String(taskId));
              if (!projectKey) return;
              const seconds = Number(row.seconds ?? 0);
              if (!Number.isFinite(seconds) || seconds <= 0) return;
              const taskKey = String(taskId);
              elapsedByTaskId.set(taskKey, (elapsedByTaskId.get(taskKey) ?? 0) + seconds);
              elapsedByProject.set(projectKey, (elapsedByProject.get(projectKey) ?? 0) + seconds);
            });
            if (elapsedRows.length < pageSize) break;
          }
        }

        totals.forEach((item) => {
          item.elapsedSeconds = Math.round(elapsedByProject.get(item.projectId) ?? 0);
          item.diffSeconds = Math.round(item.seconds - item.elapsedSeconds);
          item.hasHourMismatch = item.elapsedSeconds > 0 && Math.abs(item.diffSeconds) >= 60;
        });

        const taskMismatches = scopedRows
          .map((row) => {
            const taskId = String(row.task_id ?? "");
            if (!taskId) return null;
            const timeSpentSeconds = Math.round(getTaskTimeSpentSeconds(row as unknown as Record<string, unknown>) ?? 0);
            const elapsedSeconds = Math.round(elapsedByTaskId.get(taskId) ?? 0);
            const diffSeconds = timeSpentSeconds - elapsedSeconds;
            if (timeSpentSeconds === 0 && elapsedSeconds === 0) return null;
            if (Math.abs(diffSeconds) < 60) return null;

            const resolvedProjectId = Number(row.project_id ?? 0);
            return {
              taskId,
              title: String(row.title ?? `Tarefa #${taskId}`),
              projectId: resolvedProjectId,
              projectName: String(row.projects?.name ?? row.group_name ?? `Projeto #${resolvedProjectId}`),
              responsibleName: String(row.responsible_name ?? ""),
              timeSpentSeconds,
              elapsedSeconds,
              diffSeconds,
            };
          })
          .filter((value): value is TaskHoursMismatch => value != null)
          .sort((a, b) => Math.abs(b.diffSeconds) - Math.abs(a.diffSeconds));

        const mapped = Array.from(totals.values()).sort((a, b) => b.seconds - a.seconds);
        setData(mapped);
        setMismatches(taskMismatches);
        cacheRef.current.set(cacheKey, { timestamp: Date.now(), data: mapped, mismatches: taskMismatches });
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

  return { data: normalized, mismatches, loading, error, reload };
}
