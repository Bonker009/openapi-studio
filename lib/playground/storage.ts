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

export function getPlaygroundRequestBodies(
  specId: string
): Record<string, string> {
  return safeGet<Record<string, string>>(prefix(specId, "request_bodies")) ?? {};
}

export function setPlaygroundRequestBody(
  specId: string,
  endpointKey: string,
  body: string
): void {
  const current = getPlaygroundRequestBodies(specId);
  safeSet(prefix(specId, "request_bodies"), {
    ...current,
    [endpointKey]: body,
  });
}

export function clearPlaygroundRequestBody(
  specId: string,
  endpointKey: string
): void {
  const current = getPlaygroundRequestBodies(specId);
  if (!(endpointKey in current)) return;
  const next = { ...current };
  delete next[endpointKey];
  safeSet(prefix(specId, "request_bodies"), next);
}

export type StoredRequestParams = {
  paramValues: Record<string, string>;
  headerValues: Record<string, string>;
};

export function getPlaygroundRequestParams(
  specId: string
): Record<string, StoredRequestParams> {
  return safeGet<Record<string, StoredRequestParams>>(
    prefix(specId, "request_params")
  ) ?? {};
}

export function setPlaygroundRequestParams(
  specId: string,
  endpointKey: string,
  params: StoredRequestParams
): void {
  const current = getPlaygroundRequestParams(specId);
  safeSet(prefix(specId, "request_params"), {
    ...current,
    [endpointKey]: params,
  });
}

export function clearPlaygroundRequestParams(
  specId: string,
  endpointKey: string
): void {
  const current = getPlaygroundRequestParams(specId);
  if (!(endpointKey in current)) return;
  const next = { ...current };
  delete next[endpointKey];
  safeSet(prefix(specId, "request_params"), next);
}

export type StoredValidationConfig = {
  concurrency: number;
  passPolicyKind: "4xx" | "strict-400" | "4xx-or-422" | "custom-range";
  passPolicyMin?: number;
  passPolicyMax?: number;
  includeNoisyVariants: boolean;
  perEndpointCap: number;
};

export type ValidationOverridesStore = {
  global: Record<string, string>;
  byEndpoint: Record<string, Record<string, string>>;
};

const EMPTY_OVERRIDES_STORE: ValidationOverridesStore = {
  global: {},
  byEndpoint: {},
};

function isLegacyFlatOverrides(
  value: unknown
): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  if ("global" in obj || "byEndpoint" in obj) return false;
  return Object.values(obj).every((v) => typeof v === "string");
}

function migrateLegacyOverrides(
  specId: string,
  legacy: Record<string, string>
): ValidationOverridesStore {
  const store: ValidationOverridesStore = {
    global: { ...legacy },
    byEndpoint: {},
  };
  setValidationOverridesStore(specId, store);
  return store;
}

export function getValidationOverridesStore(
  specId: string
): ValidationOverridesStore {
  const stored = safeGet<ValidationOverridesStore>(
    prefix(specId, "validation_overrides_store")
  );
  if (stored && typeof stored === "object" && "global" in stored) {
    return {
      global: stored.global ?? {},
      byEndpoint: stored.byEndpoint ?? {},
    };
  }

  const legacy = safeGet<Record<string, string>>(
    prefix(specId, "validation_overrides")
  );
  if (legacy && isLegacyFlatOverrides(legacy)) {
    return migrateLegacyOverrides(specId, legacy);
  }

  return { ...EMPTY_OVERRIDES_STORE };
}

export function setValidationOverridesStore(
  specId: string,
  store: ValidationOverridesStore
): void {
  safeSet(prefix(specId, "validation_overrides_store"), store);
}

/** @deprecated Use getValidationOverridesStore */
export function getValidationOverrides(
  specId: string
): Record<string, string> | null {
  return getValidationOverridesStore(specId).global;
}

/** @deprecated Use setValidationOverridesStore */
export function setValidationOverrides(
  specId: string,
  overrides: Record<string, string>
): void {
  const current = getValidationOverridesStore(specId);
  setValidationOverridesStore(specId, { ...current, global: overrides });
}

export function getValidationConfig(
  specId: string
): StoredValidationConfig | null {
  return safeGet<StoredValidationConfig>(prefix(specId, "validation_config"));
}

export function setValidationConfig(
  specId: string,
  config: StoredValidationConfig
): void {
  safeSet(prefix(specId, "validation_config"), config);
}
