export const BITRIX_MANUAL_SYNC_COOLDOWN_MS = 5 * 60 * 1000;
export const BITRIX_MANUAL_SYNC_COOLDOWN_KEY = "integrations:bitrix_manual_sync_next_allowed_at:v2";

export const readNextAllowedBitrixSyncAt = () => {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(BITRIX_MANUAL_SYNC_COOLDOWN_KEY);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const reserveNextBitrixSyncWindow = (now = Date.now()) => {
  const nextAllowed = now + BITRIX_MANUAL_SYNC_COOLDOWN_MS;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(BITRIX_MANUAL_SYNC_COOLDOWN_KEY, String(nextAllowed));
  }
  return nextAllowed;
};

export const clearBitrixSyncCooldown = () => {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(BITRIX_MANUAL_SYNC_COOLDOWN_KEY);
  }
  return 0;
};

export const formatBitrixSyncCooldown = (ms: number) => {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};
