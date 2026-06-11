export type CursorRoseSettings = {
  enabled: boolean;
  color: string;
  opacity: number;
};

const STORAGE_KEY = "poseidon-cursor-rose";

export const DEFAULT_CURSOR_ROSE_SETTINGS: CursorRoseSettings = {
  enabled: true,
  color: "#eab308",
  opacity: 40,
};

export function parseCursorRoseSettings(
  raw: string | null,
): CursorRoseSettings {
  if (!raw) return DEFAULT_CURSOR_ROSE_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as Partial<CursorRoseSettings>;
    return {
      enabled:
        typeof parsed.enabled === "boolean"
          ? parsed.enabled
          : DEFAULT_CURSOR_ROSE_SETTINGS.enabled,
      color:
        typeof parsed.color === "string" &&
        /^#[0-9a-fA-F]{6}$/.test(parsed.color)
          ? parsed.color
          : DEFAULT_CURSOR_ROSE_SETTINGS.color,
      opacity:
        typeof parsed.opacity === "number" &&
        parsed.opacity >= 0 &&
        parsed.opacity <= 100
          ? parsed.opacity
          : DEFAULT_CURSOR_ROSE_SETTINGS.opacity,
    };
  } catch {
    return DEFAULT_CURSOR_ROSE_SETTINGS;
  }
}

export function hexToRgba(hex: string, opacityPercent: number) {
  const h = hex.replace("#", "");
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacityPercent / 100})`;
}

let settings: CursorRoseSettings = DEFAULT_CURSOR_ROSE_SETTINGS;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function hydrateFromStorage() {
  if (hydrated || typeof window === "undefined") return;
  settings = parseCursorRoseSettings(localStorage.getItem(STORAGE_KEY));
  hydrated = true;
}

export function getCursorRoseSettings(): CursorRoseSettings {
  hydrateFromStorage();
  return settings;
}

export function setCursorRoseSettings(patch: Partial<CursorRoseSettings>) {
  hydrateFromStorage();
  settings = { ...settings, ...patch };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }
  emit();
}

export function subscribeCursorRoseSettings(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}
