import { useCallback, useEffect, useMemo, useState } from "react";
import { INTEGRATIONS } from "@/modules/integrations/data/integrations.mock";
import {
  IntegrationState,
  IntegrationWithState,
  type IntegrationProfile,
} from "@/modules/integrations/types/integration";
import { storage } from "@/modules/shared/storage";

type IntegrationStateMap = Record<string, IntegrationState>;

type IntegrationActionResult = {
  success: boolean;
  message?: string;
};

type UseIntegrationsOptions = {
  canManage?: boolean;
};

const buildStorageKey = (email?: string | null) =>
  email ? `integrations_state:${email}` : null;

const loadSavedState = (key: string | null): IntegrationStateMap => {
  if (!key) return {};
  return storage.get<IntegrationStateMap>(key, {});
};

export function useIntegrations(
  userEmail?: string | null,
  options?: UseIntegrationsOptions
) {
  const storageKey = buildStorageKey(userEmail);
  const canManage = options?.canManage ?? true;

  const mergeWithBase = useCallback(
    (state: IntegrationStateMap) =>
      INTEGRATIONS.map((integration) => {
        const saved = state[integration.id];
        return {
          ...integration,
          status: saved?.status ?? integration.status,
          config: saved?.config,
          profiles: saved?.profiles,
          activeProfile: saved?.activeProfile,
        };
      }),
    []
  );

  const [, setStateMap] = useState<IntegrationStateMap>({});
  const [items, setItems] = useState<IntegrationWithState[]>(() =>
    mergeWithBase({})
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = loadSavedState(storageKey);
    setStateMap(saved);
    setItems(mergeWithBase(saved));
    setLoading(false);
  }, [storageKey, mergeWithBase]);

  const persistAndSync = useCallback(
    (
      updater:
        | IntegrationStateMap
        | ((prev: IntegrationStateMap) => IntegrationStateMap)
    ) => {
      setStateMap((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;

        if (storageKey) {
          storage.set(storageKey, next);
        }

        setItems(mergeWithBase(next));
        return next;
      });
    },
    [mergeWithBase, storageKey]
  );

  const connectIntegration = useCallback(
    (id: string, config: Record<string, string>): IntegrationActionResult => {
      if (!canManage) {
        return {
          success: false,
          message: "Somente administradores podem alterar conexões.",
        };
      }

      const current = items.find((item) => item.id === id);
      if (!current) {
        return { success: false, message: "Integração não encontrada." };
      }

      if (current.status === "EM_BREVE") {
        return { success: false, message: "Esta integração ainda não está disponível." };
      }

      persistAndSync((prev) => {
        if (id === "ixc") {
          const prevState = prev[id];
          const prevProfiles = prevState?.profiles ?? [];
          const { __profiles: rawProfiles, __activeProfile: rawActive, ...restConfig } =
            config as Record<string, string> & {
              __profiles?: string;
              __activeProfile?: string;
            };
          const parsedProfiles =
            rawProfiles && typeof rawProfiles === "string"
              ? (JSON.parse(rawProfiles) as IntegrationProfile[])
              : prevProfiles;
          const incomingName = (config.profileName ?? "").trim();
          const activeProfile =
            (rawActive ?? "").trim() ||
            incomingName ||
            parsedProfiles[0]?.name ||
            "IXC";
          const cleanConfig: Record<string, string> = { ...restConfig };

          const profileName = incomingName || activeProfile || "IXC";
          const newProfiles: IntegrationProfile[] = [
            { name: profileName, data: cleanConfig },
            ...parsedProfiles.filter((p) => p.name !== profileName),
          ];

          return {
            ...prev,
            [id]: {
              status: "CONECTADO",
              config: cleanConfig,
              profiles: newProfiles,
              activeProfile,
            },
          };
        }

        return {
          ...prev,
          [id]: { status: "CONECTADO", config },
        };
      });

      return { success: true };
    },
    [items, persistAndSync, canManage]
  );

  const disconnectIntegration = useCallback(
    (id: string): IntegrationActionResult => {
      if (!canManage) {
        return {
          success: false,
          message: "Somente administradores podem alterar conexões.",
        };
      }

      const current = items.find((item) => item.id === id);
      if (!current) {
        return { success: false, message: "Integração não encontrada." };
      }

      persistAndSync((prev) => {
        const updated = { ...prev };
        const prevState = updated[id];
        updated[id] = {
          status: "DISPONIVEL",
          profiles: prevState?.profiles ?? [],
          activeProfile: undefined,
          config: prevState?.config,
        };
        return updated;
      });

      return { success: true };
    },
    [items, persistAndSync, canManage]
  );

  const filteredIntegrations = useMemo(() => {
    if (!searchTerm) return items;

    return items.filter((integration) => {
      const term = searchTerm.toLowerCase();
      return (
        integration.name.toLowerCase().includes(term) ||
        integration.description.toLowerCase().includes(term)
      );
    });
  }, [items, searchTerm]);

  return {
    integrations: items,
    filteredIntegrations,
    searchTerm,
    setSearchTerm,
    loading,
    connectIntegration,
    disconnectIntegration,
    canManage,
  };
}
