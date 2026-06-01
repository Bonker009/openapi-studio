import { createRunContext, type RunContext } from "@/domain/flows/types";

export class ExecutionContext {
  readonly ctx: RunContext;

  constructor(seed?: RunContext) {
    this.ctx = seed ? structuredClone(seed) : createRunContext();
  }

  setStepResponse(index: number, response: RunContext["steps"][number]): void {
    this.ctx.steps[index] = response;
  }
}
