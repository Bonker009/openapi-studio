import type { OpenApiParameter } from "@/lib/playground/endpoints";

export function buildRequestUrl(
  baseUrl: string,
  path: string,
  paramValues: Record<string, string>,
  parameters: OpenApiParameter[]
): string {
  const base = baseUrl.replace(/\/$/, "");
  let resolvedPath = path;

  parameters
    .filter((p) => p.in === "path")
    .forEach((p) => {
      const value = paramValues[p.name] ?? `{${p.name}}`;
      resolvedPath = resolvedPath.replace(`{${p.name}}`, encodeURIComponent(value));
    });

  const queryParts = parameters
    .filter((p) => p.in === "query" && paramValues[p.name]?.trim())
    .map(
      (p) =>
        `${encodeURIComponent(p.name)}=${encodeURIComponent(paramValues[p.name])}`
    );

  const query = queryParts.length ? `?${queryParts.join("&")}` : "";
  return `${base}${resolvedPath.startsWith("/") ? "" : "/"}${resolvedPath}${query}`;
}

/** Rebuild path/query from params; keep origin from currentUrl when user set a custom host. */
export function rebuildRequestUrlPreservingOrigin(
  currentUrl: string,
  baseUrl: string,
  path: string,
  paramValues: Record<string, string>,
  parameters: OpenApiParameter[]
): string {
  const built = buildRequestUrl(baseUrl, path, paramValues, parameters);
  if (!currentUrl.trim()) return built;
  try {
    const current = new URL(currentUrl);
    const builtUrl = new URL(built);
    if (current.origin === builtUrl.origin) {
      return built;
    }
    return `${current.origin}${builtUrl.pathname}${builtUrl.search}`;
  } catch {
    return built;
  }
}

export function defaultParamValues(
  parameters: OpenApiParameter[]
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const p of parameters) {
    if (p.in !== "path" && p.in !== "query" && p.in !== "header") continue;
    if (p.schema?.enum?.[0]) values[p.name] = String(p.schema.enum[0]);
    else if (p.schema?.type === "boolean") values[p.name] = "true";
    else if (p.schema?.type === "integer" || p.schema?.type === "number")
      values[p.name] = "1";
    else if (p.schema?.format === "uuid")
      values[p.name] = "123e4567-e89b-12d3-a456-426614174000";
    else values[p.name] = "";
  }
  return values;
}
