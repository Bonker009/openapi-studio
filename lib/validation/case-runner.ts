import { buildRequestUrl } from "@/lib/playground/build-request";
import type { Credential } from "@/lib/playground/credentials";
import { applyAuthToRequest } from "@/lib/playground/apply-auth";
import type { PlaygroundEndpoint } from "@/lib/playground/endpoints";
import { executePlaygroundRequest } from "@/lib/playground/execute-request";
import {
  formatResponseBodyForDisplay,
  parseJsonValue,
} from "@/lib/playground/json-format";
import { classifyOutcome } from "@/lib/validation/pass-policy";
import type {
  PassPolicy,
  ValidationCase,
  ValidationResult,
} from "@/lib/validation/types";

const BODY_PREVIEW_MAX = 2048;

function truncate(text: string): string {
  if (text.length <= BODY_PREVIEW_MAX) return text;
  return `${text.slice(0, BODY_PREVIEW_MAX)}\n… (truncated)`;
}

function formatRequestBodyForPreview(
  body: BodyInit | null | undefined
): unknown {
  if (body == null) return null;
  if (typeof body === "string") {
    const trimmed = body.trim();
    if (!trimmed) return null;
    const parsed = parseJsonValue(trimmed);
    return parsed !== null ? parsed : body;
  }
  return String(body);
}

function buildRequestPreview(
  url: string,
  init: RequestInit,
  omitParam?: string,
  omitHeader?: string
): string {
  const headers = { ...(init.headers as Record<string, string>) };
  if (omitHeader) delete headers[omitHeader];
  return JSON.stringify(
    {
      url,
      method: init.method,
      headers,
      body: formatRequestBodyForPreview(init.body),
      omittedParam: omitParam ?? null,
      omittedHeader: omitHeader ?? null,
    },
    null,
    2
  );
}

export async function runValidationCase(
  testCase: ValidationCase,
  opts: {
    baseUrl: string;
    credential: Credential | null;
    endpoint: PlaygroundEndpoint;
    passPolicy: PassPolicy;
    apiData: { components?: unknown; paths?: Record<string, unknown> };
  }
): Promise<ValidationResult> {
  const base: ValidationResult = {
    caseId: testCase.id,
    endpointKey: testCase.endpointKey,
    path: testCase.path,
    method: testCase.method,
    controller: testCase.controller,
    category: testCase.category,
    fieldPath: testCase.fieldPath,
    variant: testCase.variant,
    name: testCase.name,
    status: 0,
    ok: false,
    outcome: "error",
    latencyMs: 0,
  };

  const paramValues = { ...testCase.paramValues };
  if (testCase.omitParam) {
    delete paramValues[testCase.omitParam];
  }

  const headers = { ...testCase.headers };
  if (testCase.omitHeader) {
    delete headers[testCase.omitHeader];
  }

  let url = buildRequestUrl(
    opts.baseUrl,
    testCase.path,
    paramValues,
    opts.endpoint.parameters
  );

  const init: RequestInit = {
    method: testCase.method,
    headers: { ...headers },
  };

  const upper = testCase.method.toUpperCase();
  if (
    testCase.body !== undefined &&
    upper !== "GET" &&
    upper !== "HEAD"
  ) {
    if (!init.headers) init.headers = {};
    const h = init.headers as Record<string, string>;
    if (!h["Content-Type"] && !h["content-type"]) {
      h["Content-Type"] = "application/json";
    }
    init.body = JSON.stringify(testCase.body);
  }

  const authed = applyAuthToRequest(
    opts.credential,
    url,
    init,
    opts.endpoint.requiresAuth
  );
  url = authed.url;
  const finalInit = authed.init;

  const requestPreview = buildRequestPreview(
    url,
    finalInit,
    testCase.omitParam,
    testCase.omitHeader
  );

  const t0 = performance.now();
  try {
    const res = await executePlaygroundRequest(url, finalInit);
    const latencyMs = Math.round(performance.now() - t0);
    const status = res.status || 0;
    const outcome = classifyOutcome(status, Boolean(res.error), opts.passPolicy);

    const isBaseline = testCase.isBaseline;
    const ok = isBaseline
      ? status >= 200 && status < 400 && !res.error
      : outcome === "pass";

    const formatted = formatResponseBodyForDisplay(res.data);
    const responseBodyPreview = formatted
      ? truncate(formatted)
      : res.error
        ? truncate(res.error)
        : undefined;

    return {
      ...base,
      status,
      statusText: res.statusText,
      ok,
      outcome: isBaseline
        ? ok
          ? "pass"
          : status >= 500 || res.error
            ? "error"
            : "fail"
        : outcome,
      latencyMs,
      error: res.error,
      responseBodyPreview,
      requestPreview,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ...base,
      latencyMs: Math.round(performance.now() - t0),
      error: message,
      responseBodyPreview: truncate(message),
      requestPreview,
    };
  }
}
