import { type NextRequest, NextResponse } from "next/server";
import {
  normalizeRequestUrl,
  performHttpRequest,
} from "@/lib/playground/perform-http-request-server";
import {
  isProxyMetaField,
  PROXY_HEADERS_FIELD,
  PROXY_METHOD_FIELD,
  PROXY_RAW_BODY_FIELD,
  PROXY_URL_FIELD,
} from "@/lib/playground/proxy-fields";
import {
  ALLOWED_HTTP_METHODS,
  filterOutboundHeaders,
  MAX_PROXY_BODY_BYTES,
  readBodyWithLimit,
} from "@/lib/security/outbound-headers";
import { assertSafeOutboundUrl, SsrfError } from "@/lib/security/ssrf-server";

export type ProxyBody = {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

export function proxyError(message: string, status = 400) {
  return NextResponse.json(
    { status: 0, error: message, data: null, headers: {}, responseTime: 0 },
    { status }
  );
}

export function stripContentType(
  headers: Record<string, string>
): Record<string, string> {
  const out = { ...headers };
  for (const key of Object.keys(out)) {
    if (key.toLowerCase() === "content-type") {
      delete out[key];
    }
  }
  return out;
}

export async function measureFormDataSize(form: FormData): Promise<number> {
  let total = 0;
  for (const [, value] of form.entries()) {
    if (value instanceof File) {
      total += value.size;
    } else {
      total += new TextEncoder().encode(String(value)).length;
    }
    if (total > MAX_PROXY_BODY_BYTES) {
      throw new Error(`Request body exceeds ${MAX_PROXY_BODY_BYTES} bytes`);
    }
  }
  return total;
}

export async function handleMultipartProxy(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return proxyError("Invalid multipart body");
  }

  try {
    await measureFormDataSize(form);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Body too large";
    return proxyError(message);
  }

  const url = form.get(PROXY_URL_FIELD)?.toString().trim();
  if (!url) {
    return proxyError("URL is required");
  }

  try {
    await assertSafeOutboundUrl(url);
  } catch (e) {
    const message = e instanceof SsrfError ? e.message : "URL not allowed";
    return proxyError(message);
  }

  const method = (form.get(PROXY_METHOD_FIELD)?.toString() ?? "GET").toUpperCase();
  if (!ALLOWED_HTTP_METHODS.has(method)) {
    return proxyError("HTTP method not allowed");
  }

  let headers: Record<string, string> = {};
  const headersRaw = form.get(PROXY_HEADERS_FIELD)?.toString();
  if (headersRaw) {
    try {
      const parsed = JSON.parse(headersRaw) as Record<string, string>;
      headers = filterOutboundHeaders(parsed);
    } catch {
      return proxyError("Invalid proxy headers JSON");
    }
  }

  const rawBody = form.get(PROXY_RAW_BODY_FIELD);
  const options: RequestInit = {
    method,
    headers: stripContentType(headers),
  };

  if (!["GET", "HEAD"].includes(method)) {
    if (rawBody instanceof File) {
      options.body = rawBody;
    } else {
      const outgoing = new FormData();
      for (const [key, value] of form.entries()) {
        if (isProxyMetaField(key)) continue;
        outgoing.append(key, value);
      }
      options.body = outgoing;
    }
  }

  const result = await performHttpRequest(normalizeRequestUrl(url), options, {
    skipSsrfCheck: true,
  });
  return NextResponse.json(result);
}

export async function handleJsonProxy(req: NextRequest) {
  let payload: ProxyBody;
  try {
    payload = (await req.json()) as ProxyBody;
  } catch {
    return proxyError("Invalid JSON body");
  }

  const url = payload.url?.trim();
  if (!url) {
    return proxyError("URL is required");
  }

  try {
    await assertSafeOutboundUrl(url);
  } catch (e) {
    const message = e instanceof SsrfError ? e.message : "URL not allowed";
    return proxyError(message);
  }

  const method = (payload.method ?? "GET").toUpperCase();
  if (!ALLOWED_HTTP_METHODS.has(method)) {
    return proxyError("HTTP method not allowed");
  }

  let body: string | undefined;
  try {
    body = readBodyWithLimit(payload.body, MAX_PROXY_BODY_BYTES);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Body too large";
    return proxyError(message);
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
