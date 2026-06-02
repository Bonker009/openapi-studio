import {
  buildRequestUrl,
  defaultParamValues,
} from "@/lib/playground/build-request";
import type { Credential } from "@/lib/playground/credentials";
import { applyAuthToRequest } from "@/lib/playground/apply-auth";
import type { PlaygroundEndpoint } from "@/lib/playground/endpoints";
import { executePlaygroundRequest } from "@/lib/playground/execute-request";
import { generateOpenApiSample } from "@/lib/playground/generate-sample";
import {
  getRequestBodyInfo,
  pickRequestBodyContent,
} from "@/lib/playground/request-body";
import { getRequestBodySchema } from "@/lib/openapi-schema";
import { formatResponseBodyForDisplay } from "@/lib/playground/json-format";
import type { HttpRequestResult } from "@/lib/playground/perform-http-request";
import { ensureFreshCredential } from "@/lib/playground/token-lifecycle";
import { playgroundAuthApplies } from "@/lib/playground/endpoint-auth-roles";

const BODY_PREVIEW_MAX = 4096;

export type SmokeResult = {
  path: string;
  method: string;
  controller: string;
  status: number;
  statusText?: string;
  ok: boolean;
  latencyMs: number;
  skipped?: "binary" | "multipart" | "no-sample";
  error?: string;
  responseHeaders?: Record<string, string>;
  responseBodyPreview?: string;
};

function truncateBodyPreview(text: string): string {
  if (text.length <= BODY_PREVIEW_MAX) return text;
  return `${text.slice(0, BODY_PREVIEW_MAX)}\n… (truncated)`;
}

function captureResponsePreview(res: HttpRequestResult): string | undefined {
  const formatted = formatResponseBodyForDisplay(res.data);
  if (formatted) return truncateBodyPreview(formatted);
  if (res.error?.trim()) return truncateBodyPreview(res.error);
  return undefined;
}

type SmokeRunnerOptions = {
  specId?: string;
  endpoints: PlaygroundEndpoint[];
  baseUrl: string;
  credential: Credential | null;
  apiData: {
    components?: unknown;
    paths?: Record<string, unknown>;
  };
  concurrency?: number;
  onProgress?: (done: number, total: number, latest: SmokeResult) => void;
  signal?: AbortSignal;
};

async function runPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
  signal?: AbortSignal
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      if (signal?.aborted) return;
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

function getOperation(
  apiData: SmokeRunnerOptions["apiData"],
  path: string,
  method: string
): Record<string, unknown> | null {
  const pathItem = apiData.paths?.[path] as
    | Record<string, unknown>
    | undefined;
  if (!pathItem || typeof pathItem !== "object") return null;
  const op = pathItem[method.toLowerCase()];
  if (!op || typeof op !== "object") return null;
  return op as Record<string, unknown>;
}

function buildParamValues(endpoint: PlaygroundEndpoint): Record<string, string> {
  const values = defaultParamValues(endpoint.parameters);
  for (const p of endpoint.parameters) {
    if (p.schema?.default != null && !values[p.name]?.trim()) {
      values[p.name] = String(p.schema.default);
    }
    if (p.schema?.enum?.[0] && !values[p.name]?.trim()) {
      values[p.name] = String(p.schema.enum[0]);
    }
  }
  return values;
}

export async function smokeOneEndpoint(
  endpoint: PlaygroundEndpoint,
  opts: SmokeRunnerOptions
): Promise<SmokeResult> {
  const base: SmokeResult = {
    path: endpoint.path,
    method: endpoint.method,
    controller: endpoint.controller,
    status: 0,
    ok: false,
    latencyMs: 0,
  };

  const op = getOperation(opts.apiData, endpoint.path, endpoint.method);
  if (!op) {
    return { ...base, skipped: "no-sample", error: "Operation not found in spec" };
  }

  const bodyInfo = getRequestBodyInfo(op, opts.apiData.components);
  if (bodyInfo.kind === "multipart") {
    return { ...base, skipped: "multipart" };
  }
  if (bodyInfo.kind === "binary") {
    return { ...base, skipped: "binary" };
  }

  const paramValues = buildParamValues(endpoint);
  let url = buildRequestUrl(
    opts.baseUrl,
    endpoint.path,
    paramValues,
    endpoint.parameters
  );

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  let init: RequestInit = {
    method: endpoint.method,
    headers,
  };

  const upper = endpoint.method.toUpperCase();
  if (
    endpoint.hasRequestBody &&
    bodyInfo.kind === "json" &&
    upper !== "GET" &&
    upper !== "HEAD"
  ) {
    const schema = getRequestBodySchema(op);
    const sample = schema
      ? generateOpenApiSample(schema, opts.apiData.components)
      : null;
    if (sample != null) {
      headers["Content-Type"] = bodyInfo.contentType ?? "application/json";
      init.body = JSON.stringify(sample);
    }
  } else if (
    endpoint.hasRequestBody &&
    bodyInfo.kind === "none" &&
    op.requestBody &&
    typeof op.requestBody === "object"
  ) {
    const content = (op.requestBody as { content?: Record<string, unknown> })
      .content;
    const picked = pickRequestBodyContent(
      content as Record<string, { schema?: unknown }> | undefined
    );
    if (picked?.mediaType.includes("multipart")) {
      return { ...base, skipped: "multipart" };
    }
    if (picked?.mediaType.includes("octet-stream")) {
      return { ...base, skipped: "binary" };
    }
  }

  let credential = opts.credential;
  if (opts.specId && credential) {
    const fresh = await ensureFreshCredential(opts.specId, credential);
    credential = fresh.credential;
  }

  const authed = applyAuthToRequest(
    credential,
    url,
    init,
    playgroundAuthApplies(endpoint.authRole)
  );
  url = authed.url;
  init = authed.init;

  const t0 = performance.now();
  try {
    const res = await executePlaygroundRequest(url, init);
    const latencyMs = Math.round(performance.now() - t0);
    const status = res.status || 0;
    const ok = status >= 200 && status < 400 && !res.error;
    return {
      ...base,
      status,
      statusText: res.statusText,
      ok,
      latencyMs,
      error: res.error,
      responseHeaders: res.headers,
      responseBodyPreview: captureResponsePreview(res),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ...base,
      latencyMs: Math.round(performance.now() - t0),
      error: message,
      responseBodyPreview: truncateBodyPreview(message),
    };
  }
}

export async function runSmokeTests(
  opts: SmokeRunnerOptions
): Promise<SmokeResult[]> {
  const { endpoints, concurrency = 4, onProgress, signal } = opts;
  const total = endpoints.length;
  let done = 0;
  const results: SmokeResult[] = [];

  const batch = await runPool(
    endpoints,
    concurrency,
    async (endpoint) => {
      if (signal?.aborted) {
        return {
          path: endpoint.path,
          method: endpoint.method,
          controller: endpoint.controller,
          status: 0,
          ok: false,
          latencyMs: 0,
          error: "Aborted",
        };
      }
      const result = await smokeOneEndpoint(endpoint, opts);
      done++;
      onProgress?.(done, total, result);
      return result;
    },
    signal
  );

  results.push(...batch);
  return results;
}

export function smokeAggregate(results: SmokeResult[]) {
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter(
    (r) => !r.ok && !r.skipped && r.status !== 0
  ).length;
  const errors = results.filter(
    (r) => !r.ok && !r.skipped && (r.status === 0 || r.error)
  ).length;
  const skipped = results.filter((r) => r.skipped).length;
  const latencies = results.filter((r) => r.latencyMs > 0).map((r) => r.latencyMs);
  const avg =
    latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0;
  return { passed, failed, errors, skipped, avg };
}
