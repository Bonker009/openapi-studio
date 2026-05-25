import type { PlaygroundEndpoint } from "@/lib/playground/endpoints";

/** Hash format: #GET-/api/v1/users-{id} */
export function endpointToHash(method: string, path: string): string {
  const encodedPath = path.replace(/\//g, "-").replace(/^-/, "");
  return `${method.toUpperCase()}-${encodedPath}`;
}

export function hashToEndpointKey(hash: string): { method: string; path: string } | null {
  const raw = hash.replace(/^#/, "").trim();
  if (!raw) return null;
  const dash = raw.indexOf("-");
  if (dash <= 0) return null;
  const method = raw.slice(0, dash).toUpperCase();
  const pathPart = raw.slice(dash + 1);
  const path = "/" + pathPart.replace(/-/g, "/");
  return { method, path };
}

export function findEndpointByHash(
  endpoints: PlaygroundEndpoint[],
  hash: string
): PlaygroundEndpoint | null {
  const key = hashToEndpointKey(hash);
  if (!key) return null;
  return (
    endpoints.find(
      (e) =>
        e.method.toUpperCase() === key.method &&
        e.path === key.path
    ) ?? null
  );
}

export function syncHashFromEndpoint(
  endpoint: PlaygroundEndpoint | null,
  enabled: boolean
): void {
  if (!enabled || typeof window === "undefined") return;
  if (!endpoint) {
    if (window.location.hash) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    return;
  }
  const next = `#${endpointToHash(endpoint.method, endpoint.path)}`;
  if (window.location.hash !== next) {
    history.replaceState(null, "", next);
  }
}
