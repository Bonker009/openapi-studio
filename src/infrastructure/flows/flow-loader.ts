import type { Flow } from "@/domain/flows/types";
import { loadFlowForExecution } from "./flow-persistence-service";

/**
 * Loader abstraction used by runtime entry points to fetch a flow definition
 * from persistence without leaking repository details into the engine.
 */
export async function loadExecutableFlow(
  specId: string,
  flowId: string
): Promise<Flow | null> {
  return loadFlowForExecution(specId, flowId);
}
