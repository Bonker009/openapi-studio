export type HttpRequestResult<T = unknown> = {
  data: T | null;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  responseTime: number;
  error?: string;
};

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

/**
 * Prefer 127.0.0.1 over localhost on the server (avoids Node IPv6 issues).
 * In the browser, keep localhost so requests stay same-origin with the UI
 * (localhost:8080 and 127.0.0.1:8080 are different origins).
 */
export function normalizeRequestUrl(
  url: string,
  opts?: { preferIpv4?: boolean }
): string {
  const preferIpv4 =
    opts?.preferIpv4 ?? typeof window === "undefined";

  try {
    const parsed = new URL(url);
    if (preferIpv4 && parsed.hostname === "localhost") {
      parsed.hostname = "127.0.0.1";
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export async function executeHttpRequest<T = unknown>(
  url: string,
  requestOptions: RequestInit
): Promise<HttpRequestResult<T>> {
  const startTime = performance.now();
  const targetUrl = normalizeRequestUrl(url);

  try {
    const response = await fetch(targetUrl, {
      ...requestOptions,
      redirect: "manual",
    });
    const endTime = performance.now();
    const responseTime = Math.round(endTime - startTime);

    if (response.status >= 300 && response.status < 400) {
      return {
        data: null,
        status: 0,
        statusText: "Redirect not followed",
        headers: {},
        responseTime,
        error:
          "Redirects are not followed for security. Use the final URL directly.",
      };
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const text = await readResponseTextLimited(response, MAX_RESPONSE_BYTES);
    let data: T | null = null;
    try {
      data = text ? (JSON.parse(text) as T) : null;
    } catch {
      data = text as unknown as T;
    }

    return {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      responseTime,
      error: response.ok ? undefined : response.statusText,
    };
  } catch (error) {
    const endTime = performance.now();
    const message = error instanceof Error ? error.message : String(error);
    return {
      data: null,
      status: 0,
      statusText: "Request failed",
      headers: {},
      responseTime: Math.round(endTime - startTime),
      error: message,
    };
  }
}

async function readResponseTextLimited(
  response: Response,
  maxBytes: number
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return response.text();

  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`Response exceeds ${maxBytes} bytes`);
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}
