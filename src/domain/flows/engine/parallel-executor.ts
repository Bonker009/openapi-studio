import { createRunContext, type RunContext } from "@/domain/flows/types";
import type { FlowRunResult, StepRunResult } from "@/domain/flows/types";
import {
  StepExecutor,
  skippedStepResult,
  type StepExecutorOptions,
} from "./step-executor";
import { computeFlowOutcome } from "./run-outcome";
import type { RunFlowOptions } from "./run-flow-options";

/**
 * Runs steps concurrently. Each step uses an isolated RunContext clone (no shared
 * captures between parallel steps). Pause / step-through are not supported.
 */
export async function runParallel(
  opts: RunFlowOptions,
  baseCtx: RunContext
): Promise<FlowRunResult> {
  const startedAt = Date.now();
  const stepExecutor = new StepExecutor();
  const total = opts.flow.steps.length;
  const startIndex = opts.startIndex ?? 0;

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

  const results: StepRunResult[] = new Array(total);

  for (let i = 0; i < startIndex; i++) {
    const step = opts.flow.steps[i];
    const prior =
      opts.priorResults?.[i] ??
      skippedStepResult(step, i, "Reused from previous run");
    results[i] = prior;
    opts.onProgress?.(prior, i, total);
  }

  const indicesToRun: number[] = [];
  for (let i = startIndex; i < total; i++) {
    if (opts.signal?.aborted) {
      const step = opts.flow.steps[i];
      const skipped = skippedStepResult(step, i, "Run cancelled");
      results[i] = skipped;
      opts.onProgress?.(skipped, i, total);
      continue;
    }
    indicesToRun.push(i);
  }

  await Promise.all(
    indicesToRun.map(async (i) => {
      const step = opts.flow.steps[i];
      const stepCtx = createRunContext({
        vars: { ...baseCtx.vars },
        global: { ...baseCtx.global },
        env: { ...baseCtx.env },
        stepIndexByName: { ...baseCtx.stepIndexByName },
        steps: Array.from({ length: total }, () => undefined),
      });

      const result = await stepExecutor.run(step, i, stepCtx, executorOpts);
      results[i] = result;
      opts.onProgress?.(result, i, total);
    })
  );

  const finishedAt = Date.now();
  return {
    steps: results,
    startedAt,
    finishedAt,
    outcome: computeFlowOutcome(results),
    context: baseCtx,
  };
}
