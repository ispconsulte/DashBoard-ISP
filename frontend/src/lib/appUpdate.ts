const UPDATE_CONTEXT_KEY = "app_update_context";
const FORM_RESTORE_ATTEMPTS = 12;
const FORM_RESTORE_INTERVAL_MS = 250;

type SavedField = {
  key: string;
  value: string;
  type: string;
  checked?: boolean;
};

type UpdateContextSnapshot = {
  href: string;
  pathname: string;
  search: string;
  hash: string;
  scrollX: number;
  scrollY: number;
  capturedAt: number;
  fields: SavedField[];
};

function getFieldKey(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) {
  return (
    element.getAttribute("data-update-key") ||
    element.name ||
    element.id ||
    element.getAttribute("aria-label") ||
    ""
  ).trim();
}

function getSerializableFields(): SavedField[] {
  if (typeof document === "undefined") return [];

  const nodes = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select")
  );

  return nodes
    .map((element) => {
      const key = getFieldKey(element);
      if (!key || element.disabled) return null;

      if (element instanceof HTMLInputElement) {
        if (["password", "file", "hidden", "submit", "button", "image", "reset"].includes(element.type)) {
          return null;
        }

        if (element.type === "checkbox" || element.type === "radio") {
          return {
            key,
            value: element.value,
            type: element.type,
            checked: element.checked,
          };
        }
      }

      return {
        key,
        value: element.value,
        type: element instanceof HTMLInputElement ? element.type : element.tagName.toLowerCase(),
      };
    })
    .filter((field) => field !== null) as SavedField[];
}

function findField(key: string) {
  const escaped = typeof CSS !== "undefined" && "escape" in CSS ? CSS.escape(key) : key.replace(/"/g, '\\"');
  return (
    document.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[data-update-key="${escaped}"]`) ||
    document.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[name="${escaped}"]`) ||
    document.getElementById(key) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null
  );
}

function restoreField(field: SavedField) {
  const target = findField(field.key);
  if (!target) return false;

  if (target instanceof HTMLInputElement && (target.type === "checkbox" || target.type === "radio")) {
    target.checked = Boolean(field.checked);
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  target.focus({ preventScroll: true });
  target.value = field.value;
  target.dispatchEvent(new Event("input", { bubbles: true }));
  target.dispatchEvent(new Event("change", { bubbles: true }));
  target.blur();
  return true;
}

export function saveUpdateContext() {
  if (typeof window === "undefined") return;

  const snapshot: UpdateContextSnapshot = {
    href: window.location.href,
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    capturedAt: Date.now(),
    fields: getSerializableFields(),
  };

  sessionStorage.setItem(UPDATE_CONTEXT_KEY, JSON.stringify(snapshot));
}

export function consumeUpdateContext() {
  if (typeof window === "undefined") return;

  const raw = sessionStorage.getItem(UPDATE_CONTEXT_KEY);
  if (!raw) return;

  sessionStorage.removeItem(UPDATE_CONTEXT_KEY);

  let snapshot: UpdateContextSnapshot | null = null;
  try {
    snapshot = JSON.parse(raw) as UpdateContextSnapshot;
  } catch {
    return;
  }

  if (!snapshot) return;

  const sameRoute =
    snapshot.pathname === window.location.pathname &&
    snapshot.search === window.location.search &&
    snapshot.hash === window.location.hash;

  if (!sameRoute) {
    window.history.replaceState({}, "", `${snapshot.pathname}${snapshot.search}${snapshot.hash}`);
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    snapshot?.fields.forEach((field) => restoreField(field));

    if (attempts >= FORM_RESTORE_ATTEMPTS) {
      window.clearInterval(timer);
      window.scrollTo({ top: snapshot?.scrollY ?? 0, left: snapshot?.scrollX ?? 0, behavior: "auto" });
    }
  }, FORM_RESTORE_INTERVAL_MS);
}
