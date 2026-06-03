import {
  evaluateConditionalRule,
  evaluateStepCondition,
} from "@/domain/flows/requests/step-condition";
import type { FlowRunResult, RunContext } from "@/domain/flows/types";
import { PauseController } from "./pause-controller";
import {
  StepExecutor,
  skippedStepResult,
  type StepExecutorOptions,
} from "./step-executor";
import { computeFlowOutcome } from "./run-outcome";
import type { RunFlowOptions } from "./run-flow-options";

/**
 * Sequential execution with per-step `condition` gates (skip when falsy).
 */
export async function runConditional(
  opts: RunFlowOptions,
  ctx: RunContext
): Promise<FlowRunResult> {
  const startedAt = Date.now();
  const stepExecutor = new StepExecutor();
  const pauseController = new PauseController();
  const total = opts.flow.steps.length;
  const startIndex = opts.startIndex ?? 0;
  let aborted = false;

  const credentialState = {
    credentials: opts.credentials,
    defaultCredential: opts.defaultCredential,
  };

  const executorOpts: StepExecutorOptions = {
    flow: opts.flow,
    endpoints: opts.endpoints,
    baseUrl: opts.baseUrl,
    get credentials() {
      return credentialState.credentials;
    },
    get defaultCredential() {
      return credentialState.defaultCredential;
    },
    requestPort: opts.requestPort,
    execute: opts.execute,
    prepareStep: opts.prepareStep
      ? async (state) => {
          await opts.prepareStep!(credentialState);
          state.credentials = credentialState.credentials;
          state.defaultCredential = credentialState.defaultCredential;
        }
      : undefined,
  };

  const resultsByIndex = new Map<number, FlowRunResult["steps"][number]>();
  const indexById = new Map(opts.flow.steps.map((s, i) => [s.id, i] as const));
  const outgoing = new Map<string, { target: string; kind: "seq" | "true" | "false" }[]>();
  const conns =
    opts.flow.connections && opts.flow.connections.length > 0
      ? opts.flow.connections.map((c) => ({
          source: c.source,
          target: c.target,
          kind: (c.kind ?? "seq") as "seq" | "true" | "false",
        }))
      : opts.flow.steps.slice(0, -1).map((s, i) => ({
          source: s.id,
          target: opts.flow.steps[i + 1]!.id,
          kind: "seq" as const,
        }));
  const indegree = new Map<string, number>();
  for (const s of opts.flow.steps) indegree.set(s.id, 0);
  for (const c of conns) {
    if (!indexById.has(c.source) || !indexById.has(c.target)) continue;
    indegree.set(c.target, (indegree.get(c.target) ?? 0) + 1);
    const list = outgoing.get(c.source) ?? [];
    list.push(c);
    outgoing.set(c.source, list);
  }

  const roots = opts.flow.steps
    .filter((s) => (indegree.get(s.id) ?? 0) === 0)
    .map((s) => s.id);
  let currentId: string | undefined = roots[0] ?? opts.flow.steps[0]?.id;
  const visited = new Set<string>();
  while (currentId) {
    const i = indexById.get(currentId);
    if (i == null) break;
    const step = opts.flow.steps[i]!;
    visited.add(step.id);

    if (i < startIndex) {
      const prior =
        opts.priorResults?.[i] ??
        skippedStepResult(step, i, "Reused from previous run");
      resultsByIndex.set(i, prior);
      opts.onProgress?.(prior, i, total);
      currentId =
        outgoing.get(step.id)?.find((c) => c.kind === "seq")?.target;
      continue;
    }

    if (aborted || opts.signal?.aborted) {
      const skipped = skippedStepResult(
        step,
        i,
        opts.signal?.aborted ? "Run cancelled" : "Skipped after earlier failure"
      );
      resultsByIndex.set(i, skipped);
      opts.onProgress?.(skipped, i, total);
      currentId =
        outgoing.get(step.id)?.find((c) => c.kind === "seq")?.target;
      continue;
    }

    if (step.stepKind === "conditional" && step.conditional) {
      const cond = evaluateConditionalRule(step.conditional, ctx);
      const condResult = {
        stepId: step.id,
        stepName: step.name,
        index: i,
        endpointKey: step.endpointKey,
        method: "COND",
        path: step.conditional.left,
        outcome: cond.shouldRun ? ("pass" as const) : ("skipped" as const),
        status: cond.shouldRun ? 1 : 0,
        latencyMs: 0,
        capturedVars: {},
        assertions: [],
        error: cond.shouldRun ? undefined : cond.reason,
        errorMessage: cond.shouldRun ? undefined : cond.reason,
        runStatus: cond.shouldRun ? ("passed" as const) : ("skipped" as const),
      };
      resultsByIndex.set(i, condResult);
      opts.onProgress?.(condResult, i, total);
      const branch = cond.shouldRun ? "true" : "false";
      currentId =
        outgoing.get(step.id)?.find((c) => c.kind === branch)?.target ??
        outgoing.get(step.id)?.find((c) => c.kind === "seq")?.target;
      continue;
    }

    const gate = evaluateStepCondition(step.condition, ctx);
    if (!gate.shouldRun) {
      const skipped = skippedStepResult(
        step,
        i,
        gate.reason ?? "Condition not met"
      );
      resultsByIndex.set(i, skipped);
      opts.onProgress?.(skipped, i, total);
      currentId =
        outgoing.get(step.id)?.find((c) => c.kind === "seq")?.target;
      continue;
    }

    const result = await stepExecutor.run(step, i, ctx, executorOpts);
    resultsByIndex.set(i, result);
    opts.onProgress?.(result, i, total);

    const shouldPause =
      !!opts.onPause &&
      result.outcome !== "skipped" &&
      (opts.stepThrough || step.pauseAfter);
    if (shouldPause && !opts.signal?.aborted) {
      const action = await pauseController.handlePause(
        { step, index: i, total, result },
        ctx,
        opts.onPause!
      );
      if (action === "stop") aborted = true;
    }

    if (
      opts.flow.onStepFailure === "stop" &&
      (result.outcome === "fail" || result.outcome === "error")
    ) {
      aborted = true;
    }
    currentId = outgoing.get(step.id)?.find((c) => c.kind === "seq")?.target;
    if (currentId && visited.has(currentId)) {
      currentId = undefined;
    }
  }

  for (let i = 0; i < opts.flow.steps.length; i++) {
    if (resultsByIndex.has(i)) continue;
    const step = opts.flow.steps[i]!;
    const skipped = skippedStepResult(step, i, "Branch not taken");
    resultsByIndex.set(i, skipped);
    opts.onProgress?.(skipped, i, total);
  }
  const results = Array.from(resultsByIndex.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, r]) => r);

  const finishedAt = Date.now();
  return {
    steps: results,
    startedAt,
    finishedAt,
    outcome: computeFlowOutcome(results),
    context: ctx,
  };
}
