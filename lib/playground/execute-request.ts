import {
  normalizeRequestUrl,
  performHttpRequest,
  type HttpRequestResult,
} from "@/lib/playground/perform-http-request";
import { isPlaygroundProxyEnabled } from "@/lib/security/route-auth";
import {
  PROXY_HEADERS_FIELD,
  PROXY_METHOD_FIELD,
  PROXY_RAW_BODY_FIELD,
  PROXY_URL_FIELD,
} from "@/lib/playground/proxy-fields";

export type { HttpRequestResult };

function formatNetworkError(url: string, message: string, viaProxy: boolean): string {
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  })();

  const lines = [
    message || "fetch failed",
    "",
    viaProxy
      ? `The server proxy could not reach ${host}.`
      : `Could not reach ${host} from your browser.`,
    "• Confirm the API is running (e.g. port 9090).",
    "• Try http://127.0.0.1:9090 instead of localhost.",
  ];

  if (!viaProxy) {
    lines.push(
      "• If the API blocks browser calls, enable CORS for this app’s origin — the playground will retry via server proxy."
    );
  }

  return lines.join("\n");
}

function collectRequestHeaders(requestOptions: RequestInit): Record<string, string> {
  const headers: Record<string, string> = {};
  const raw = requestOptions.headers;
  if (raw instanceof Headers) {
    raw.forEach((v, k) => {
      headers[k] = v;
    });
  } else if (Array.isArray(raw)) {
    for (const [k, v] of raw) headers[k] = v;
  } else if (raw && typeof raw === "object") {
    Object.assign(headers, raw);
  }
  return headers;
}

async function fetchViaProxyJson(
  url: string,
  requestOptions: RequestInit,
  headers: Record<string, string>
): Promise<HttpRequestResult> {
  const res = await fetch("/api/playground/proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      url: normalizeRequestUrl(url),
      method: requestOptions.method ?? "GET",
      headers,
      body:
        typeof requestOptions.body === "string"
          ? requestOptions.body
          : undefined,
    }),
  });
  return parseProxyResponse(res, url, true);
}

async function fetchViaProxyFormData(
  url: string,
  requestOptions: RequestInit,
  headers: Record<string, string>,
  body: FormData | Blob | File
): Promise<HttpRequestResult> {
  const proxyForm = new FormData();
  proxyForm.append(PROXY_URL_FIELD, normalizeRequestUrl(url));
  proxyForm.append(PROXY_METHOD_FIELD, requestOptions.method ?? "GET");
  proxyForm.append(PROXY_HEADERS_FIELD, JSON.stringify(headers));

  if (body instanceof FormData) {
    for (const [key, value] of body.entries()) {
      proxyForm.append(key, value);
    }
  } else {
    proxyForm.append(PROXY_RAW_BODY_FIELD, body, body instanceof File ? body.name : "body");
  }

  const res = await fetch("/api/playground/proxy", {
    method: "POST",
    body: proxyForm,
  });
  return parseProxyResponse(res, url, true);
}

async function parseProxyResponse(
  res: Response,
  url: string,
  viaProxy: boolean
): Promise<HttpRequestResult> {
  const payload = (await res.json()) as HttpRequestResult & { message?: string };

  if (!res.ok && payload.status === 0) {
    return {
      ...payload,
      error: formatNetworkError(
        url,
        payload.error ?? payload.message ?? "Proxy failed",
        viaProxy
      ),
    };
  }

  if (payload.status === 0 && payload.error) {
    return {
      ...payload,
      error: formatNetworkError(url, payload.error, viaProxy),
    };
  }

  return payload;
}

async function fetchViaProxy(
  url: string,
  requestOptions: RequestInit
): Promise<HttpRequestResult> {
  if (!isPlaygroundProxyEnabled()) {
    return {
      data: null,
      status: 0,
      statusText: "Proxy disabled",
      headers: {},
      responseTime: 0,
      error:
        "Server proxy is disabled. Enable ENABLE_PLAYGROUND_PROXY or fix CORS on the API.",
    };
  }

  const headers = collectRequestHeaders(requestOptions);
  const body = requestOptions.body;

  if (body instanceof FormData || body instanceof Blob) {
    return fetchViaProxyFormData(url, requestOptions, headers, body);
  }

  return fetchViaProxyJson(url, requestOptions, headers);
}

/**
 * Run a playground request from the browser (Postman-style). Falls back to a
 * same-origin server proxy when the browser cannot reach the target (CORS/network).
 */
export async function executePlaygroundRequest(
  url: string,
  requestOptions: RequestInit
): Promise<HttpRequestResult> {
  const normalized = normalizeRequestUrl(url);

  try {
    const direct = await performHttpRequest(normalized, requestOptions);
    if (direct.status !== 0) {
      return direct;
    }
    return fetchViaProxy(url, requestOptions);
  } catch {
    return fetchViaProxy(url, requestOptions);
  }
}
