import { type NextRequest, NextResponse } from "next/server";

function bearerToken(request: NextRequest): string | null {
  const auth = request.headers.get("authorization");
  if (!auth) return null;
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  return match?.[1]?.trim() ?? null;
}

function requestOrigin(request: NextRequest): string | null {
  const origin = request.headers.get("origin");
  if (origin) return origin;
  const referer = request.headers.get("referer");
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

function isSameOriginBrowserRequest(request: NextRequest): boolean {
  const host = request.headers.get("host");
  const origin = requestOrigin(request);
  if (!host || !origin) {
    return request.headers.get("sec-fetch-site") === "same-origin";
  }
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Protects API routes. When DATA_API_KEY is set, requires X-API-Key or Bearer match.
 * In production without a key, only same-origin browser requests are allowed.
 */
export function checkRouteAuth(request: NextRequest): NextResponse | null {
  const apiKey = process.env.DATA_API_KEY?.trim();

  if (apiKey) {
    const provided =
      request.headers.get("x-api-key")?.trim() ?? bearerToken(request);
    if (provided === apiKey) return null;
  }

  if (isSameOriginBrowserRequest(request)) return null;

  if (process.env.NODE_ENV !== "production") return null;

  if (apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export function isPlaygroundProxyEnabled(): boolean {
  return process.env.ENABLE_PLAYGROUND_PROXY !== "false";
}
