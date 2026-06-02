import type { Credential } from "@/lib/playground/credentials";

function mergeHeaders(
  init: RequestInit,
  extra: Record<string, string>
): RequestInit {
  const headers = new Headers(init.headers ?? {});
  for (const [k, v] of Object.entries(extra)) {
    if (v) headers.set(k, v);
  }
  return { ...init, headers };
}

function appendQueryParam(url: string, name: string, value: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set(name, value);
    return u.toString();
  } catch {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
  }
}

/** Inject auth from a playground credential into URL and fetch init. */
export function applyAuthToRequest(
  credential: Credential | null,
  url: string,
  init: RequestInit,
  requiresAuth = true
): { url: string; init: RequestInit } {
  if (!requiresAuth || !credential) return { url, init };

  switch (credential.type) {
    case "bearer": {
      const token = credential.token?.trim();
      if (!token) return { url, init };
      return {
        url,
        init: mergeHeaders(init, { Authorization: `Bearer ${token}` }),
      };
    }
    case "basic": {
      const user = credential.username ?? "";
      const pass = credential.password ?? "";
      if (!user && !pass) return { url, init };
      const encoded = btoa(`${user}:${pass}`);
      return {
        url,
        init: mergeHeaders(init, { Authorization: `Basic ${encoded}` }),
      };
    }
    case "apiKey": {
      const value = credential.value?.trim();
      if (!value) return { url, init };
      if (credential.in === "query") {
        return {
          url: appendQueryParam(url, credential.paramName, value),
          init,
        };
      }
      return {
        url,
        init: mergeHeaders(init, { [credential.paramName]: value }),
      };
    }
    case "oauth2cc":
    case "oauth2rt": {
      const token = credential.accessToken?.trim();
      if (!token) return { url, init };
      return {
        url,
        init: mergeHeaders(init, { Authorization: `Bearer ${token}` }),
      };
    }
    default:
      return { url, init };
  }
}

/** Headers map for curl / display (excludes Content-Type from caller). */
export function authHeadersForCurl(
  credential: Credential | null,
  requiresAuth = true
): Record<string, string> {
  if (!requiresAuth || !credential) return {};

  switch (credential.type) {
    case "bearer": {
      const token = credential.token?.trim();
      return token ? { Authorization: `Bearer ${token}` } : {};
    }
    case "basic": {
      const user = credential.username ?? "";
      const pass = credential.password ?? "";
      if (!user && !pass) return {};
      const encoded = btoa(`${user}:${pass}`);
      return { Authorization: `Basic ${encoded}` };
    }
    case "apiKey": {
      if (credential.in === "header" && credential.value?.trim()) {
        return { [credential.paramName]: credential.value.trim() };
      }
      return {};
    }
    case "oauth2cc":
    case "oauth2rt": {
      const token = credential.accessToken?.trim();
      return token ? { Authorization: `Bearer ${token}` } : {};
    }
    default:
      return {};
  }
}

/** Query params from apiKey auth (for curl URL building). */
export function authQueryForUrl(
  credential: Credential | null,
  requiresAuth = true
): Record<string, string> {
  if (!requiresAuth || credential?.type !== "apiKey" || credential.in !== "query") {
    return {};
  }
  const value = credential.value?.trim();
  if (value) return { [credential.paramName]: value };
  return {};
}
