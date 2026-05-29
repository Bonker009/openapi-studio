/**
 * Sequential flow executor. Framework-agnostic: the HTTP transport is injected
 * via `execute`, so the same engine works in the browser (proxy-backed) or a
 * future headless host (plain fetch).
 */
import { buildRequestUrl } from "@/lib/playground/build-request";
import { applyAuthToRequest } from "@/lib/playground/apply-auth";
import type { Credential } from "@/lib/playground/credentials";
import type { PlaygroundEndpoint } from "@/lib/playground/endpoints";
import type { HttpRequestResult } from "@/lib/playground/http-request-core";
import {
  getByPath,
  resolveRecord,
  resolveString,
  type RunContext,
} from "@/lib/flows/resolve-refs";
import {
  flowEndpointKey,
  type Extraction,
  type Flow,
  type FlowStep,
  type StepRunResult,
  type FlowRunResult,
  type FlowStepOutcome,
} from "@/lib/flows/types";

const BODY_PREVIEW_MAX = 2048;

function truncate(text: string): string {
  if (text.length <= BODY_PREVIEW_MAX) return text;
  return `${text.slice(0, BODY_PREVIEW_MAX)}\n… (truncated)`;
}

export type FlowExecutor = (
  url: string,
  init: RequestInit
) => Promise<HttpRequestResult>;

export type RunFlowOptions = {
  flow: Flow;
  endpoints: PlaygroundEndpoint[];
  baseUrl: string;
  credentials: Credential[];
  defaultCredential: Credential | null;
  execute: FlowExecutor;
  signal?: AbortSignal;
  onProgress?: (result: StepRunResult, index: number, total: number) => void;
  /**
   * Execution-order index to begin at. Earlier steps are not re-executed; their
   * results come from `priorResults` and their state from `seedContext`.
   */
  startIndex?: number;
  /** Prior run context (vars + step responses) reused when resuming. */
  seedContext?: RunContext;
  /** Results for indices `< startIndex` (execution order), reused as-is. */
  priorResults?: StepRunResult[];
  /** Pause after every step (interactive step-through mode). */
  stepThrough?: boolean;
  /**
   * Called after a step when stepThrough or step.pauseAfter is set. Resolve with
   * "continue" (optionally with extra live captures to apply) or "stop".
   */
  onPause?: (info: PauseInfo) => Promise<PauseDecision>;
};

export type PauseInfo = {
  step: FlowStep;
  index: number;
  total: number;
  result: StepRunResult;
};

export type PauseDecision = {
  action: "continue" | "stop";
  /** Extra captures (typically body picks) to apply before continuing. */
  extraCaptures?: Extraction[];
};

function resolveCredential(
  step: FlowStep,
  credentials: Credential[],
  defaultCredential: Credential | null
): { credential: Credential | null; roleUsed: string; missingRole: boolean } {
  const name = step.credentialName?.trim();
  if (!name || name === "No auth") {
    if (name === "No auth") {
      return { credential: null, roleUsed: "No auth", missingRole: false };
    }
    return {
      credential: defaultCredential,
      roleUsed: defaultCredential?.name ?? "No auth",
      missingRole: false,
    };
  }
  const match = credentials.find((c) => c.name === name);
  if (!match) {
    return { credential: null, roleUsed: name, missingRole: true };
  }
  return { credential: match, roleUsed: match.name, missingRole: false };
}

function formatBody(body: unknown): string | undefined {
  if (body == null) return undefined;
  if (typeof body === "string") return truncate(body);
  try {
    return truncate(JSON.stringify(body, null, 2));
  } catch {
    return truncate(String(body));
  }
}

function skippedResult(
  step: FlowStep,
  index: number,
  reason: string
): StepRunResult {
  const [method, ...rest] = step.endpointKey.split(":");
  return {
    stepId: step.id,
    index,
    endpointKey: step.endpointKey,
    method: method ?? "",
    path: rest.join(":"),
    outcome: "skipped",
    status: 0,
    latencyMs: 0,
    capturedVars: {},
    error: reason,
  };
}

async function runStep(
  step: FlowStep,
  index: number,
  ctx: RunContext,
  opts: RunFlowOptions
): Promise<StepRunResult> {
  const endpoint = opts.endpoints.find(
    (e) => flowEndpointKey(e) === step.endpointKey
  );
  const [methodFromKey, ...pathRest] = step.endpointKey.split(":");
  const method = endpoint?.method ?? methodFromKey ?? "GET";
  const path = endpoint?.path ?? pathRest.join(":");

  const base: StepRunResult = {
    stepId: step.id,
    index,
    endpointKey: step.endpointKey,
    method,
    path,
    outcome: "error",
    status: 0,
    latencyMs: 0,
    capturedVars: {},
  };

  if (!endpoint) {
    return {
      ...base,
      error: `Endpoint ${step.endpointKey} is not in the current spec.`,
    };
  }

  const resolvedParams = resolveRecord(step.paramValues, ctx);
  const resolvedHeaders = resolveRecord(step.headerValues, ctx);
  const resolvedBody = step.body
    ? resolveString(step.body, ctx)
    : { value: undefined as string | undefined, missing: [] as string[] };

  const missing = [
    ...resolvedParams.missing,
    ...resolvedHeaders.missing,
    ...resolvedBody.missing,
  ];
  if (missing.length > 0) {
    return {
      ...base,
      outcome: "error",
      error: `Unresolved references: ${[...new Set(missing)].join(", ")}`,
    };
  }

  const role = resolveCredential(step, opts.credentials, opts.defaultCredential);

  let url = buildRequestUrl(
    opts.baseUrl,
    endpoint.path,
    resolvedParams.values,
    endpoint.parameters
  );

  const headers: Record<string, string> = { Accept: "application/json" };
  for (const [k, v] of Object.entries(resolvedHeaders.values)) {
    if (v) headers[k] = v;
  }

  const init: RequestInit = { method, headers };

  const upper = method.toUpperCase();
  if (resolvedBody.value && upper !== "GET" && upper !== "HEAD") {
    if (!headers["Content-Type"] && !headers["content-type"]) {
      headers["Content-Type"] = "application/json";
    }
    init.body = resolvedBody.value;
  }

  const authed = applyAuthToRequest(
    role.credential,
    url,
    init,
    endpoint.requiresAuth
  );
  url = authed.url;

  const requestPreview = JSON.stringify(
    {
      url,
      method,
      role: role.roleUsed,
      headers: authed.init.headers,
      body: resolvedBody.value ? safeParse(resolvedBody.value) : null,
    },
    null,
    2
  );

  const t0 = Date.now();
  try {
    const res = await opts.execute(url, authed.init);
    const latencyMs = Date.now() - t0;
    const status = res.status || 0;

    const stepResponse = {
      status,
      statusText: res.statusText,
      headers: res.headers ?? {},
      body: res.data,
    };
    ctx.steps[index] = stepResponse;

    const capturedVars: Record<string, string> = {};
    for (const ex of step.extractions) {
      if (!ex.name.trim()) continue;
      let value: unknown;
      if (ex.source === "status") value = status;
      else if (ex.source === "headers") {
        const key = Object.keys(stepResponse.headers).find(
          (k) => k.toLowerCase() === ex.path.trim().toLowerCase()
        );
        value = key ? stepResponse.headers[key] : undefined;
      } else value = getByPath(res.data, ex.path);
      const varName = ex.name.trim();
      if (value === undefined) {
        delete ctx.vars[varName];
        capturedVars[varName] = "(not found)";
      } else {
        ctx.vars[varName] = value;
        capturedVars[varName] = stringifyShort(value);
      }
    }

    let outcome: FlowStepOutcome;
    let error: string | undefined = res.error;
    if (status === 0) {
      outcome = "error";
      error = res.error ?? "Request failed (no response)";
    } else if (typeof step.expectedStatus === "number") {
      outcome = status === step.expectedStatus ? "pass" : "fail";
      if (outcome === "fail") {
        error = `Expected ${step.expectedStatus}, got ${status}`;
      }
    } else {
      outcome = status >= 200 && status < 400 ? "pass" : "fail";
    }

    if (role.missingRole) {
      error = error
        ? `${error} (role "${role.roleUsed}" has no saved credential; ran unauthenticated)`
        : `Role "${role.roleUsed}" has no saved credential; ran unauthenticated.`;
    }

    return {
      ...base,
      outcome,
      status,
      statusText: res.statusText,
      latencyMs,
      resolvedUrl: url,
      requestPreview,
      responseBodyPreview: formatBody(res.data) ?? (res.error ? truncate(res.error) : undefined),
      responseBody: res.data,
      capturedVars,
      roleUsed: role.roleUsed,
      error,
    };
  } catch (err) {
    return {
      ...base,
      outcome: "error",
      latencyMs: Date.now() - t0,
      resolvedUrl: url,
      requestPreview,
      roleUsed: role.roleUsed,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function stringifyShort(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export async function runFlow(opts: RunFlowOptions): Promise<FlowRunResult> {
  const startedAt = Date.now();
  const ctx: RunContext = opts.seedContext
    ? structuredClone(opts.seedContext)
    : { vars: {}, steps: [] };
  const results: StepRunResult[] = [];
  const total = opts.flow.steps.length;
  const startIndex = opts.startIndex ?? 0;
  let aborted = false;

  for (let i = 0; i < opts.flow.steps.length; i++) {
    const step = opts.flow.steps[i];

    if (i < startIndex) {
      const prior =
        opts.priorResults?.[i] ??
        skippedResult(step, i, "Reused from previous run");
      results.push(prior);
      opts.onProgress?.(prior, i, total);
      continue;
    }

    if (aborted || opts.signal?.aborted) {
      const skipped = skippedResult(
        step,
        i,
        opts.signal?.aborted ? "Run cancelled" : "Skipped after earlier failure"
      );
      results.push(skipped);
      opts.onProgress?.(skipped, i, total);
      continue;
    }

    const result = await runStep(step, i, ctx, opts);
    results.push(result);
    opts.onProgress?.(result, i, total);

    const shouldPause =
      !!opts.onPause &&
      result.outcome !== "skipped" &&
      (opts.stepThrough || step.pauseAfter);
    if (shouldPause && !opts.signal?.aborted) {
      const decision = await opts.onPause!({ step, index: i, total, result });
      if (decision.extraCaptures?.length) {
        for (const ex of decision.extraCaptures) {
          const name = ex.name.trim();
          if (!name) continue;
          let value: unknown;
          if (ex.source === "status") value = result.status;
          else value = getByPath(result.responseBody, ex.path);
          if (value === undefined) {
            delete ctx.vars[name];
            result.capturedVars[name] = "(not found)";
          } else {
            ctx.vars[name] = value;
            result.capturedVars[name] = stringifyShort(value);
          }
        }
      }
      if (decision.action === "stop") aborted = true;
    }

    if (
      opts.flow.onStepFailure === "stop" &&
      (result.outcome === "fail" || result.outcome === "error")
    ) {
      aborted = true;
    }
  }

  const finishedAt = Date.now();
  const ran = results.filter((r) => r.outcome !== "skipped");
  const outcome: FlowStepOutcome = results.some((r) => r.outcome === "error")
    ? "error"
    : results.some((r) => r.outcome === "fail")
      ? "fail"
      : ran.length > 0
        ? "pass"
        : "skipped";

  return { steps: results, startedAt, finishedAt, outcome, context: ctx };
}
