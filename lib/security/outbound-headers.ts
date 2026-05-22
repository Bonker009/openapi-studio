const ALLOWED_EXACT = new Set([
  "accept",
  "accept-language",
  "accept-encoding",
  "content-type",
  "authorization",
  "cache-control",
  "if-none-match",
  "if-modified-since",
]);

const ALLOWED_PREFIXES = ["x-", "x-api-", "x-request-"];

export function filterOutboundHeaders(
  headers: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (lower === "host" || lower === "content-length" || lower === "connection") {
      continue;
    }
    if (lower === "cookie" || lower === "set-cookie") continue;
    if (
      lower.startsWith("proxy-") ||
      lower.startsWith("sec-") ||
      lower === "transfer-encoding" ||
      lower === "upgrade"
    ) {
      continue;
    }
    if (ALLOWED_EXACT.has(lower)) {
      out[lower] = value;
      continue;
    }
    if (ALLOWED_PREFIXES.some((p) => lower.startsWith(p))) {
      out[key] = value;
    }
  }
  return out;
}

export const ALLOWED_HTTP_METHODS = new Set([
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
]);

export const MAX_PROXY_BODY_BYTES = 1024 * 1024;
export const MAX_SPEC_POST_BYTES = 10 * 1024 * 1024;

export function readBodyWithLimit(
  body: string | undefined,
  maxBytes: number
): string | undefined {
  if (!body?.trim()) return undefined;
  const bytes = new TextEncoder().encode(body).length;
  if (bytes > maxBytes) {
    throw new Error(`Request body exceeds ${maxBytes} bytes`);
  }
  return body;
}
