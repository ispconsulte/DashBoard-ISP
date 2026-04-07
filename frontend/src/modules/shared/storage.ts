const isBrowser = () => typeof window !== "undefined";
const memoryStore = new Map<string, string>();

function clearCachedEntries() {
  for (const currentKey of memoryStore.keys()) {
    if (currentKey.startsWith("cache:")) memoryStore.delete(currentKey);
  }
}

function readRaw(key: string): string | null {
  return memoryStore.get(key) ?? null;
}

function writeRaw(key: string, value: string) {
  memoryStore.set(key, value);
}

function removeRaw(key: string) {
  memoryStore.delete(key);
}

export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = readRaw(key);
      if (!raw) return fallback;
      return JSON.parse(raw) as T;
    } catch (error) {
      console.error(`Erro ao ler storage em memória (${key}):`, error);
      return fallback;
    }
  },

  set<T>(key: string, value: T) {
    try {
      writeRaw(key, JSON.stringify(value));
    } catch (error) {
      const isQuotaError =
        error instanceof DOMException &&
        (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED");

      if (isQuotaError && key.startsWith("cache:")) {
        clearCachedEntries();
        try {
          writeRaw(key, JSON.stringify(value));
          return;
        } catch (retryError) {
          console.error(`Erro ao salvar storage em memória (${key}) após limpar cache:`, retryError);
          return;
        }
      }

      console.error(`Erro ao salvar storage em memória (${key}):`, error);
    }
  },

  remove(key: string) {
    try {
      removeRaw(key);
    } catch (error) {
      console.error(`Erro ao remover storage em memória (${key}):`, error);
    }
  },

  keys(prefix = "") {
    return Array.from(memoryStore.keys()).filter((key) => key.startsWith(prefix));
  },
};

export const supabaseMemoryStorage = {
  getItem(key: string) {
    return isBrowser() ? readRaw(key) : null;
  },
  setItem(key: string, value: string) {
    if (!isBrowser()) return;
    writeRaw(key, value);
  },
  removeItem(key: string) {
    if (!isBrowser()) return;
    removeRaw(key);
  },
};
