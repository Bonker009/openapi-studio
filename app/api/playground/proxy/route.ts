import { type NextRequest, NextResponse } from "next/server";
import {
  normalizeRequestUrl,
  performHttpRequest,
} from "@/lib/playground/perform-http-request-server";
import {
  ALLOWED_HTTP_METHODS,
  filterOutboundHeaders,
  MAX_PROXY_BODY_BYTES,
  readBodyWithLimit,
} from "@/lib/security/outbound-headers";
import {
  checkRouteAuth,
  isPlaygroundProxyEnabled,
} from "@/lib/security/route-auth";
import { assertSafeOutboundUrl, SsrfError } from "@/lib/security/ssrf-server";

type ProxyBody = {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

export async function POST(req: NextRequest) {
  const authError = checkRouteAuth(req);
  if (authError) return authError;

  if (!isPlaygroundProxyEnabled()) {
    return NextResponse.json(
      {
        status: 0,
        error: "Playground proxy is disabled",
        data: null,
        headers: {},
        responseTime: 0,
      },
      { status: 403 }
    );
  }

  let payload: ProxyBody;
  try {
    payload = (await req.json()) as ProxyBody;
  } catch {
    return NextResponse.json(
      {
        status: 0,
        error: "Invalid JSON body",
        data: null,
        headers: {},
        responseTime: 0,
      },
      { status: 400 }
    );
  }

  const url = payload.url?.trim();
  if (!url) {
    return NextResponse.json(
      {
        status: 0,
        error: "URL is required",
        data: null,
        headers: {},
        responseTime: 0,
      },
      { status: 400 }
    );
  }

  try {
    await assertSafeOutboundUrl(url);
  } catch (e) {
    const message = e instanceof SsrfError ? e.message : "URL not allowed";
    return NextResponse.json(
      { status: 0, error: message, data: null, headers: {}, responseTime: 0 },
      { status: 400 }
    );
  }

  const method = (payload.method ?? "GET").toUpperCase();
  if (!ALLOWED_HTTP_METHODS.has(method)) {
    return NextResponse.json(
      { status: 0, error: "HTTP method not allowed", data: null, headers: {}, responseTime: 0 },
      { status: 400 }
    );
  }

  let body: string | undefined;
  try {
    body = readBodyWithLimit(payload.body, MAX_PROXY_BODY_BYTES);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Body too large";
    return NextResponse.json(
      { status: 0, error: message, data: null, headers: {}, responseTime: 0 },
      { status: 400 }
    );
  }

  const headers = filterOutboundHeaders(payload.headers ?? {});

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && !["GET", "HEAD"].includes(method)) {
    options.body = body;
  }

  const result = await performHttpRequest(normalizeRequestUrl(url), options, {
    skipSsrfCheck: true,
  });
  return NextResponse.json(result);
}
