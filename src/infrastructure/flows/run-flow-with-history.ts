import { runFlow } from "@/domain/flows/engine";
import type { RunFlowOptions } from "@/domain/flows/engine";
import type { FlowRunResult } from "@/domain/flows/types";
import { persistFlowRunMetadata } from "./flow-persistence-service";

/**
 * Executes a flow in-memory and persists only execution metadata after completion.
 * Runtime request/response payloads are intentionally not persisted.
 */
export async function runFlowWithHistory(
  opts: RunFlowOptions
): Promise<FlowRunResult> {
  const result = await runFlow(opts);
  await persistFlowRunMetadata({ flow: opts.flow, run: result });
  return result;
}
