import type { FlowStepOutcome, StepRunResult } from "@/domain/flows/types";

export function computeFlowOutcome(results: StepRunResult[]): FlowStepOutcome {
  const ran = results.filter((r) => r.outcome !== "skipped");
  if (results.some((r) => r.outcome === "error")) return "error";
  if (results.some((r) => r.outcome === "fail")) return "fail";
  return ran.length > 0 ? "pass" : "skipped";
}
