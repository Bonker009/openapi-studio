import type { PlaygroundEndpoint } from "@/lib/playground/endpoints";
import { getRequestBodySchema } from "@/lib/openapi-schema";
import type { OverrideMap, ValidationOverridesStore } from "@/lib/validation/types";
import { deepClone, setDeepValue } from "@/lib/validation/utils";

/** Apply overrides by exact key name anywhere in a nested object. */
export function applyOverridesToBody(
  body: Record<string, unknown>,
  overrides: OverrideMap
): Record<string, unknown> {
  if (!body || Object.keys(overrides).length === 0) {
    return deepClone(body);
  }
  const result = deepClone(body);

  const walk = (node: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(node)) {
      if (key in overrides) {
        node[key] = coerceOverrideValue(overrides[key]);
      } else if (value && typeof value === "object" && !Array.isArray(value)) {
        walk(value as Record<string, unknown>);
      } else if (Array.isArray(value)) {
        value.forEach((item) => {
          if (item && typeof item === "object" && !Array.isArray(item)) {
            walk(item as Record<string, unknown>);
          }
        });
      }
    }
  };

  walk(result);

  for (const [path, raw] of Object.entries(overrides)) {
    if (path.includes(".") || path.includes("[")) {
      setDeepValue(result, path, coerceOverrideValue(raw));
    }
  }

  return result;
}

export function applyOverridesToParams(
  params: Record<string, string>,
  overrides: OverrideMap
): Record<string, string> {
  const result = { ...params };
  for (const [key, value] of Object.entries(overrides)) {
    if (key in result) {
      result[key] = value;
    }
  }
  return result;
}

export function applyOverridesToHeaders(
  headers: Record<string, string>,
  overrides: OverrideMap
): Record<string, string> {
  const result = { ...headers };
  for (const [key, value] of Object.entries(overrides)) {
    const lower = key.toLowerCase();
    const match = Object.keys(result).find((h) => h.toLowerCase() === lower);
    if (match) {
      result[match] = value;
    } else if (!key.includes(".")) {
      result[key] = value;
    }
  }
  return result;
}

function coerceOverrideValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === "null") return null;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return raw;
    }
  }
  return raw;
}

/** Merge global defaults with endpoint-specific overrides (endpoint wins). */
export function resolveOverridesForEndpoint(
  store: ValidationOverridesStore,
  key: string
): OverrideMap {
  return {
    ...store.global,
    ...(store.byEndpoint[key] ?? {}),
  };
}

/** Suggest override keys for a single endpoint operation only. */
export function suggestOverrideKeysForEndpoint(
  apiData: {
    paths?: Record<string, unknown>;
    components?: unknown;
  },
  endpoint: PlaygroundEndpoint
): string[] {
  const keys = new Set<string>();
  const comps = apiData.components as
    | { schemas?: Record<string, unknown> }
    | undefined;

  const collectFromSchema = (schema: unknown, depth = 0) => {
    if (!schema || depth > 8 || typeof schema !== "object") return;
    const s = schema as Record<string, unknown>;
    if (typeof s.$ref === "string") {
      const name = s.$ref.replace(/^#\/components\/schemas\//, "");
      const target = comps?.schemas?.[name];
      if (target) collectFromSchema(target, depth + 1);
      return;
    }
    const props = s.properties as Record<string, unknown> | undefined;
    if (props) {
      for (const [propName, propSchema] of Object.entries(props)) {
        if (shouldSuggestKey(propName, propSchema)) {
          keys.add(propName);
        }
        collectFromSchema(propSchema, depth + 1);
      }
    }
  };

  const pathItem = apiData.paths?.[endpoint.path] as
    | Record<string, unknown>
    | undefined;
  const op = pathItem?.[endpoint.method.toLowerCase()] as
    | Record<string, unknown>
    | undefined;

  if (op) {
    for (const p of endpoint.parameters) {
      if (shouldSuggestKey(p.name, p.schema)) {
        keys.add(p.name);
      }
    }
    const schema = getRequestBodySchema(
      op as { requestBody?: { content?: Record<string, { schema?: unknown }> } }
    );
    if (schema) collectFromSchema(schema);
  }

  return [...keys].sort((a, b) => a.localeCompare(b));
}

/** Count override fields configured for an endpoint (endpoint + inherited global keys). */
export function countOverridesForEndpoint(
  store: ValidationOverridesStore,
  key: string
): number {
  const merged = resolveOverridesForEndpoint(store, key);
  return Object.keys(merged).filter((k) => merged[k]?.trim()).length;
}

/** Suggest override keys from schemas and parameters (full spec). */
export function suggestOverrideKeys(apiData: {
  paths?: Record<string, unknown>;
  components?: unknown;
}): string[] {
  const keys = new Set<string>();
  const comps = apiData.components as
    | { schemas?: Record<string, unknown> }
    | undefined;

  const collectFromSchema = (schema: unknown, depth = 0) => {
    if (!schema || depth > 8 || typeof schema !== "object") return;
    const s = schema as Record<string, unknown>;
    if (typeof s.$ref === "string") {
      const name = s.$ref.replace(/^#\/components\/schemas\//, "");
      const target = comps?.schemas?.[name];
      if (target) collectFromSchema(target, depth + 1);
      return;
    }
    const props = s.properties as Record<string, unknown> | undefined;
    if (props) {
      for (const [propName, propSchema] of Object.entries(props)) {
        if (shouldSuggestKey(propName, propSchema)) {
          keys.add(propName);
        }
        collectFromSchema(propSchema, depth + 1);
      }
    }
  };

  for (const schema of Object.values(comps?.schemas ?? {})) {
    collectFromSchema(schema);
  }

  for (const pathItem of Object.values(apiData.paths ?? {})) {
    if (!pathItem || typeof pathItem !== "object") continue;
    for (const op of Object.values(pathItem as Record<string, unknown>)) {
      if (!op || typeof op !== "object") continue;
      const operation = op as Record<string, unknown>;
      for (const p of (operation.parameters as { name?: string; schema?: unknown }[]) ?? []) {
        if (p.name && shouldSuggestKey(p.name, p.schema)) {
          keys.add(p.name);
        }
      }
      const rb = operation.requestBody as
        | { content?: Record<string, { schema?: unknown }> }
        | undefined;
      const schema =
        rb?.content?.["application/json"]?.schema ??
        rb?.content?.["application/*+json"]?.schema;
      if (schema) collectFromSchema(schema);
    }
  }

  return [...keys].sort((a, b) => a.localeCompare(b));
}

function shouldSuggestKey(name: string, schema: unknown): boolean {
  const lower = name.toLowerCase();
  if (lower.endsWith("id") || lower.endsWith("_id")) return true;
  if (!schema || typeof schema !== "object") return false;
  const s = schema as Record<string, unknown>;
  if (s.format === "uuid") return true;
  if (typeof s.$ref === "string") {
    const refName = s.$ref.split("/").pop()?.toLowerCase() ?? "";
    return refName.includes("id");
  }
  return false;
}
