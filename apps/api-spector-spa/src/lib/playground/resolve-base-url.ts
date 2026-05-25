/** True when the OpenAPI server URL is relative (e.g. `/` or `/api`). */
export function isRelativeServerUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed || trimmed === "/") return true;
  return trimmed.startsWith("/") && !trimmed.startsWith("//");
}

/**
 * Resolve an OpenAPI server entry to an absolute base URL for try-it requests.
 * Relative values use `origin` (defaults to window.location.origin in the browser).
 */
export function resolveServerBaseUrl(
  serverUrl: string,
  origin?: string
): string {
  const trimmed = serverUrl.trim();
  const baseOrigin =
    origin ??
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:8080");

  if (!trimmed || trimmed === "/") {
    return baseOrigin.replace(/\/$/, "");
  }

  if (isRelativeServerUrl(trimmed)) {
    const path = trimmed.replace(/\/$/, "");
    return `${baseOrigin.replace(/\/$/, "")}${path}`;
  }

  try {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname.replace(/\/$/, "");
    return `${parsed.origin}${pathname}`;
  } catch {
    return trimmed.replace(/\/$/, "");
  }
}

/** Pick the first usable base URL from config, OpenAPI servers, or the browser origin. */
export function resolveDefaultBaseUrl(options: {
  configuredUrl?: string;
  servers?: { url: string }[];
  origin?: string;
}): string {
  if (options.configuredUrl?.trim()) {
    return resolveServerBaseUrl(options.configuredUrl, options.origin);
  }

  const firstServer = options.servers?.[0]?.url;
  if (firstServer) {
    return resolveServerBaseUrl(firstServer, options.origin);
  }

  return resolveServerBaseUrl("/", options.origin);
}
