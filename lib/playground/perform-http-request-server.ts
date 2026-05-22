import "server-only";

import {
  executeHttpRequest,
  normalizeRequestUrl,
  type HttpRequestResult,
} from "@/lib/playground/http-request-core";
import { assertSafeOutboundUrl, SsrfError } from "@/lib/security/ssrf-server";

export type { HttpRequestResult };
export { normalizeRequestUrl };

export type PerformHttpRequestOptions = {
  /** Set when URL was already validated (e.g. playground proxy). */
  skipSsrfCheck?: boolean;
};

export async function performHttpRequest<T = unknown>(
  url: string,
  requestOptions: RequestInit,
  options: PerformHttpRequestOptions = {}
): Promise<HttpRequestResult<T>> {
  const targetUrl = normalizeRequestUrl(url);

  if (!options.skipSsrfCheck) {
    try {
      await assertSafeOutboundUrl(targetUrl);
    } catch (e) {
      const message = e instanceof SsrfError ? e.message : "URL not allowed";
      return {
        data: null,
        status: 0,
        statusText: "Blocked",
        headers: {},
        responseTime: 0,
        error: message,
      };
    }
  }

  return executeHttpRequest<T>(targetUrl, requestOptions);
}
