export type PlaygroundEnvironment = {
  id: string;
  name: string;
  url: string;
  isCustom?: boolean;
};

const prefix = (specId: string, key: string) => `playground_${key}_${specId}`;

function safeGet<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeSet<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota errors */
  }
}

export function getEnvironments(specId: string): PlaygroundEnvironment[] | null {
  return safeGet<PlaygroundEnvironment[]>(prefix(specId, "envs"));
}

export function setEnvironments(
  specId: string,
  envs: PlaygroundEnvironment[]
): void {
  safeSet(prefix(specId, "envs"), envs);
}

export function getActiveEnvironment(specId: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(prefix(specId, "active_env"));
}

export function setActiveEnvironment(specId: string, name: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(prefix(specId, "active_env"), name);
}

export function getTokens(specId: string): Record<string, string> | null {
  return safeGet<Record<string, string>>(prefix(specId, "tokens"));
}

export function setTokens(specId: string, tokens: Record<string, string>): void {
  safeSet(prefix(specId, "tokens"), tokens);
}

export function getActiveToken(specId: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(prefix(specId, "active_token"));
}

export function setActiveToken(specId: string, name: string | null): void {
  if (typeof window === "undefined") return;
  if (name === null) {
    localStorage.removeItem(prefix(specId, "active_token"));
  } else {
    localStorage.setItem(prefix(specId, "active_token"), name);
  }
}
