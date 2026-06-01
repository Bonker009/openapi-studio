import {
  assertionsPassed,
  evaluateAssertionRules,
} from "@/domain/flows/assertions/assertion-rules";
import { ExtractionEngine } from "@/domain/flows/extraction";
import type { FlowRequestPort } from "@/domain/flows/requests/request-port";
import { resolveRecord, resolveString } from "@/domain/flows/requests/variable-resolver";
import type {
  Flow,
  FlowStep,
  FlowStepOutcome,
  RunContext,
  StepRunResult,
  StepRunStatus,
} from "@/domain/flows/types";
import type { FlowCredential } from "@/domain/flows/requests/credential-resolver";
import type { FlowEndpointDescriptor } from "@/domain/flows/requests/request-port";
import type { FlowExecutor, FlowHttpResult } from "./http-types";

const BODY_PREVIEW_MAX = 2048;

function truncate(text: string): string {
  if (text.length <= BODY_PREVIEW_MAX) return text;
  return `${text.slice(0, BODY_PREVIEW_MAX)}\n… (truncated)`;
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

function outcomeToRunStatus(outcome: FlowStepOutcome): StepRunStatus {
  if (outcome === "pass") return "passed";
  if (outcome === "fail") return "failed";
  if (outcome === "skipped") return "skipped";
  return "error";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type StepExecutorOptions = {
  flow: Flow;
  endpoints: FlowEndpointDescriptor[];
  baseUrl: string;
  credentials: FlowCredential[];
  defaultCredential: FlowCredential | null;
  requestPort: FlowRequestPort;
  execute: FlowExecutor;
};

export class StepExecutor {
  private readonly extractionEngine = new ExtractionEngine();

  async run(
    step: FlowStep,
    index: number,
    ctx: RunContext,
    opts: StepExecutorOptions
  ): Promise<StepRunResult> {
    if (step.delayMs && step.delayMs > 0) {
      await sleep(step.delayMs);
    }

    const maxAttempts = Math.max(1, (step.retry?.count ?? 0) + 1);
    const retryDelay = step.retry?.delayMs ?? 0;
    let last: StepRunResult | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0 && retryDelay > 0) await sleep(retryDelay);
      last = await this.runOnce(step, index, ctx, opts);
      if (last.outcome === "pass" || last.outcome === "skipped") break;
    }

    return last!;
  }

  private async runOnce(
    step: FlowStep,
    index: number,
    ctx: RunContext,
    opts: StepExecutorOptions
  ): Promise<StepRunResult> {
    const endpoint = opts.endpoints.find((e) => {
      const key = `${e.method.toUpperCase()}:${e.path}`;
      return key === step.endpointKey;
    });
    const [methodFromKey, ...pathRest] = step.endpointKey.split(":");
    const method = endpoint?.method ?? methodFromKey ?? "GET";
    const path = endpoint?.path ?? pathRest.join(":");

    const base: StepRunResult = {
      stepId: step.id,
      stepName: step.name,
      index,
      endpointKey: step.endpointKey,
      method,
      path,
      outcome: "error",
      status: 0,
      latencyMs: 0,
      capturedVars: {},
      assertions: [],
    };

    if (!endpoint) {
      return this.finalize(base, {
        error: `Endpoint ${step.endpointKey} is not in the current spec.`,
      });
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
      return this.finalize(base, {
        outcome: "error",
        error: `Unresolved references: ${[...new Set(missing)].join(", ")}`,
      });
    }

    const built = opts.requestPort.buildStepRequest({
      step: {
        ...step,
        paramValues: resolvedParams.values,
        headerValues: resolvedHeaders.values,
        body: resolvedBody.value,
      },
      flow: opts.flow,
      endpoint,
      ctx,
      baseUrl: opts.baseUrl,
      credentials: opts.credentials,
      defaultCredential: opts.defaultCredential,
    });

    if (!built.ok) {
      return this.finalize(base, { error: built.error });
    }

    const { url, init, requestPreview, roleUsed, missingRole } = built.request;

    const requestSnapshot = {
      url,
      method,
      headers: init.headers as Record<string, string> | undefined,
      body: resolvedBody.value ? tryParse(resolvedBody.value) : undefined,
    };

    const t0 = Date.now();
    try {
      const res: FlowHttpResult = await opts.execute(url, init);
      const latencyMs = Date.now() - t0;
      const status = res.status || 0;

      const stepResponse = {
        status,
        statusText: res.statusText,
        headers: res.headers ?? {},
        body: res.data,
      };
      ctx.steps[index] = stepResponse;

      const capturedVars = this.extractionEngine.applyExtractions(
        step.extractions,
        stepResponse,
        res.data,
        status,
        ctx
      );

      const assertionDetails = evaluateAssertionRules([], {
        status,
        headers: stepResponse.headers,
        body: res.data,
        legacyExpectedStatus: step.expectedStatus,
      });

      let outcome: FlowStepOutcome = "error";
      let error: string | undefined = res.error;

      if (status === 0) {
        outcome = "error";
        error = res.error ?? "Request failed (no response)";
      } else if (assertionsPassed(assertionDetails)) {
        outcome = status >= 200 && status < 400 ? "pass" : "fail";
        if (outcome === "fail" && !error) {
          error = `HTTP ${status}`;
        }
      } else {
        outcome = "fail";
        error =
          assertionDetails.find((a) => !a.passed)?.message ??
          "Assertion failed";
      }

      if (missingRole) {
        error = error
          ? `${error} (role "${roleUsed}" has no saved credential)`
          : `Role "${roleUsed}" has no saved credential; ran unauthenticated.`;
      }

      return this.finalize(
        {
          ...base,
          outcome,
          status,
          statusText: res.statusText,
          latencyMs,
          resolvedUrl: url,
          requestPreview,
          responseBodyPreview:
            formatBody(res.data) ??
            (res.error ? truncate(res.error) : undefined),
          responseBody: res.data,
          capturedVars,
          roleUsed,
          error,
          request: requestSnapshot,
          response: {
            status,
            statusText: res.statusText,
            headers: stepResponse.headers,
            body: res.data,
          },
          assertions: assertionDetails,
        },
        {}
      );
    } catch (err) {
      return this.finalize(
        {
          ...base,
          outcome: "error",
          latencyMs: Date.now() - t0,
          resolvedUrl: url,
          requestPreview,
          roleUsed,
          request: requestSnapshot,
          error: err instanceof Error ? err.message : String(err),
        },
        {}
      );
    }
  }

  private finalize(
    partial: StepRunResult,
    patch: Partial<StepRunResult>
  ): StepRunResult {
    const merged = { ...partial, ...patch };
    merged.runStatus = outcomeToRunStatus(merged.outcome);
    merged.errorMessage = merged.error;
    return merged;
  }
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function skippedStepResult(
  step: FlowStep,
  index: number,
  reason: string
): StepRunResult {
  const [method, ...rest] = step.endpointKey.split(":");
  return {
    stepId: step.id,
    stepName: step.name,
    index,
    endpointKey: step.endpointKey,
    method: method ?? "",
    path: rest.join(":"),
    outcome: "skipped",
    runStatus: "skipped",
    status: 0,
    latencyMs: 0,
    capturedVars: {},
    assertions: [],
    error: reason,
    errorMessage: reason,
  };
}
