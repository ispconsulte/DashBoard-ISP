import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

type ProjectHoursRow = {
  cliente_id: number;
  cliente_nome: string;
  projeto_id: number;
  projeto_nome: string;
  total_segundos: number;
  total_horas: number;
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
  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/rpc/get_consumo_horas`;
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
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            data_inicio: startIso,
            data_fim: endIso,
            filtro_cliente_id: clientId ?? null,
            filtro_project_id: projectId ?? null,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || `Erro ao buscar horas (status ${response.status}).`);
        }

        const rows = (await response.json()) as ProjectHoursRow[];
        const mapped: ProjectHours[] = rows.map((row) => ({
          projectId: row.projeto_id,
          projectName: row.projeto_nome,
          clientId: row.cliente_id,
          clientName: row.cliente_nome,
          hours: Number(row.total_horas ?? 0),
          seconds: Number(row.total_segundos ?? 0),
        }));
        setData(mapped);
        cacheRef.current.set(cacheKey, { timestamp: Date.now(), data: mapped });
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = (err as Error).message || "Não foi possível carregar as horas.";
        console.error("[useProjectHours] fetch error", message);
        setError(message);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchData();
    return () => controller.abort();
  }, [endpoint, key, envError, startIso, endIso, clientId, projectId, refreshFlag]);

  const normalized = useMemo(
    () => data.filter((d) => Number.isFinite(d.hours) && d.projectName),
    [data]
  );

  return { data: normalized, loading, error, reload };
}
