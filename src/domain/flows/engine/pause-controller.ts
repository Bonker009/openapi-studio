import { ExtractionEngine } from "@/domain/flows/extraction";
import type {
  Extraction,
  FlowStep,
  RunContext,
  StepRunResult,
} from "@/domain/flows/types";

export type PauseInfo = {
  step: FlowStep;
  index: number;
  total: number;
  result: StepRunResult;
};

export type PauseDecision = {
  action: "continue" | "stop";
  extraCaptures?: Extraction[];
};

export type PauseHandler = (info: PauseInfo) => Promise<PauseDecision>;

export class PauseController {
  private readonly extractionEngine = new ExtractionEngine();

  async handlePause(
    info: PauseInfo,
    ctx: RunContext,
    onPause: PauseHandler
  ): Promise<"continue" | "stop"> {
    const decision = await onPause(info);
    if (decision.extraCaptures?.length) {
      this.extractionEngine.applyExtraCaptures(
        decision.extraCaptures,
        ctx,
        info.result
      );
    }
    return decision.action;
  }
}
