import { evaluateStepCondition } from "@/domain/flows/requests/step-condition";
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

  const results: FlowRunResult["steps"] = [];

  for (let i = 0; i < opts.flow.steps.length; i++) {
    const step = opts.flow.steps[i];

    if (i < startIndex) {
      const prior =
        opts.priorResults?.[i] ??
        skippedStepResult(step, i, "Reused from previous run");
      results.push(prior);
      opts.onProgress?.(prior, i, total);
      continue;
    }

    if (aborted || opts.signal?.aborted) {
      const skipped = skippedStepResult(
        step,
        i,
        opts.signal?.aborted ? "Run cancelled" : "Skipped after earlier failure"
      );
      results.push(skipped);
      opts.onProgress?.(skipped, i, total);
      continue;
    }

    const gate = evaluateStepCondition(step.condition, ctx);
    if (!gate.shouldRun) {
      const skipped = skippedStepResult(
        step,
        i,
        gate.reason ?? "Condition not met"
      );
      results.push(skipped);
      opts.onProgress?.(skipped, i, total);
      continue;
    }

    const result = await stepExecutor.run(step, i, ctx, executorOpts);
    results.push(result);
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
  }

  const finishedAt = Date.now();
  return {
    steps: results,
    startedAt,
    finishedAt,
    outcome: computeFlowOutcome(results),
    context: ctx,
  };
}
