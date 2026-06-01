import { ExecutionContext } from "./execution-context";
import { PauseController } from "./pause-controller";
import {
  StepExecutor,
  skippedStepResult,
  type StepExecutorOptions,
} from "./step-executor";
import {
  registerStepNames,
  seedRunContext,
} from "@/domain/flows/requests/variable-resolver";
import type { FlowRunResult, RunContext } from "@/domain/flows/types";
import { runParallel } from "./parallel-executor";
import { runConditional } from "./conditional-executor";
import { computeFlowOutcome } from "./run-outcome";
import {
  resolveEnvironmentRecord,
  type RunFlowOptions,
} from "./run-flow-options";

export type { RunFlowOptions } from "./run-flow-options";

export class FlowRunner {
  private readonly stepExecutor = new StepExecutor();
  private readonly pauseController = new PauseController();

  async run(opts: RunFlowOptions): Promise<FlowRunResult> {
    const envRecord = resolveEnvironmentRecord(opts);
    const execution = new ExecutionContext(
      seedRunContext({
        seed: opts.seedContext,
        environment: envRecord,
        flowVariables: opts.flow.variables,
      })
    );
    const ctx = execution.ctx;
    registerStepNames(
      ctx,
      opts.flow.steps.map((s) => ({ id: s.id, name: s.name }))
    );

    const mode = opts.flow.executionMode ?? "sequential";

    if (mode === "parallel") {
      return runParallel(opts, ctx);
    }
    if (mode === "conditional") {
      return runConditional(opts, ctx);
    }

    return this.runSequential(opts, ctx);
  }

  private async runSequential(
    opts: RunFlowOptions,
    ctx: RunContext
  ): Promise<FlowRunResult> {
    const startedAt = Date.now();
    const results: FlowRunResult["steps"] = [];
    const total = opts.flow.steps.length;
    const startIndex = opts.startIndex ?? 0;
    let aborted = false;

    const executorOpts: StepExecutorOptions = {
      flow: opts.flow,
      endpoints: opts.endpoints,
      baseUrl: opts.baseUrl,
      credentials: opts.credentials,
      defaultCredential: opts.defaultCredential,
      requestPort: opts.requestPort,
      execute: opts.execute,
    };

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

      const result = await this.stepExecutor.run(step, i, ctx, executorOpts);
      results.push(result);
      opts.onProgress?.(result, i, total);

      const shouldPause =
        !!opts.onPause &&
        result.outcome !== "skipped" &&
        (opts.stepThrough || step.pauseAfter);
      if (shouldPause && !opts.signal?.aborted) {
        const action = await this.pauseController.handlePause(
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
}

export async function runFlow(opts: RunFlowOptions): Promise<FlowRunResult> {
  return new FlowRunner().run(opts);
}

export { flowLoginCredential } from "@/domain/flows/requests/credential-resolver";
