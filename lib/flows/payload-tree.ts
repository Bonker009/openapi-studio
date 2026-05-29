/**
 * Resolve a pickable payload for a flow step (live run response, else an
 * OpenAPI response sample) and convert react-json-tree key paths into the
 * dot/bracket accessor used by getByPath and {{steps.N.body.<path>}} tokens.
 */
import type { PlaygroundEndpoint } from "@/lib/playground/endpoints";
import { getOperationSamples } from "@/lib/playground/generate-sample";
import {
  getEndpointMethodData,
  type FlowApiData,
} from "@/lib/flows/step-defaults";
import type { StepRunResult } from "@/lib/flows/types";

export type PayloadSource = "live" | "sample" | "none";

export type StepPayload = {
  source: PayloadSource;
  body: unknown;
};

function isPickable(value: unknown): boolean {
  return value !== null && typeof value === "object";
}

/** Prefer the actual last-run response body; fall back to the OpenAPI sample. */
export function getStepPayload(
  endpoint: PlaygroundEndpoint | undefined,
  apiData: FlowApiData,
  baseUrl: string,
  runResult?: StepRunResult
): StepPayload {
  if (runResult && isPickable(runResult.responseBody)) {
    return { source: "live", body: runResult.responseBody };
  }

  if (endpoint) {
    const methodData = getEndpointMethodData(endpoint, apiData);
    const samples = getOperationSamples(
      baseUrl,
      endpoint.path,
      methodData,
      endpoint.parameters,
      apiData.components
    );
    const sampleBody = samples?.responses[0]?.body;
    if (sampleBody) {
      try {
        const parsed = JSON.parse(sampleBody);
        if (isPickable(parsed)) return { source: "sample", body: parsed };
      } catch {
        /* not JSON; nothing to pick */
      }
    }
  }

  return { source: "none", body: undefined };
}

/**
 * react-json-tree passes `keyPath` leaf-first. With the default root visible it
 * ends in `"root"`, e.g. ["id", 0, "data", "root"] → "data[0].id". With
 * `hideRoot` there is no synthetic root, e.g. ["generationId", 0, "payload"]
 * → "payload[0].generationId".
 */
export function keyPathToAccessor(
  keyPath: readonly (string | number)[]
): string {
  const trimmed =
    keyPath.length > 0 && keyPath[keyPath.length - 1] === "root"
      ? keyPath.slice(0, -1)
      : keyPath;
  const segments = [...trimmed].reverse();
  let accessor = "";
  for (const seg of segments) {
    if (typeof seg === "number") {
      accessor += `[${seg}]`;
    } else if (/^\d+$/.test(seg)) {
      accessor += `[${seg}]`;
    } else {
      accessor += accessor ? `.${seg}` : seg;
    }
  }
  return accessor;
}
