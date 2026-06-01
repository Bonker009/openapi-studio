import { getByPath } from "@/domain/flows/requests/variable-resolver";
import type { Extraction, RunContext, StepResponse } from "@/domain/flows/types";

function stringifyShort(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function extractValue(
  ex: Extraction,
  stepResponse: StepResponse,
  responseBody: unknown,
  status: number
): unknown {
  if (ex.source === "status") return status;
  if (ex.source === "headers") {
    const key = Object.keys(stepResponse.headers).find(
      (k) => k.toLowerCase() === ex.path.trim().toLowerCase()
    );
    return key ? stepResponse.headers[key] : undefined;
  }
  return getByPath(responseBody, ex.path);
}

export class ExtractionEngine {
  applyExtractions(
    extractions: Extraction[],
    stepResponse: StepResponse,
    responseBody: unknown,
    status: number,
    ctx: RunContext
  ): Record<string, string> {
    const capturedVars: Record<string, string> = {};
    for (const ex of extractions) {
      if (!ex.name.trim()) continue;
      const value = extractValue(ex, stepResponse, responseBody, status);
      const varName = ex.name.trim();
      if (value === undefined) {
        delete ctx.vars[varName];
        capturedVars[varName] = "(not found)";
      } else {
        ctx.vars[varName] = value;
        capturedVars[varName] = stringifyShort(value);
      }
    }
    return capturedVars;
  }

  applyExtraCaptures(
    extractions: Extraction[],
    ctx: RunContext,
    result: { status: number; responseBody?: unknown; capturedVars: Record<string, string> }
  ): void {
    for (const ex of extractions) {
      const name = ex.name.trim();
      if (!name) continue;
      let value: unknown;
      if (ex.source === "status") value = result.status;
      else value = getByPath(result.responseBody, ex.path);
      if (value === undefined) {
        delete ctx.vars[name];
        result.capturedVars[name] = "(not found)";
      } else {
        ctx.vars[name] = value;
        result.capturedVars[name] = stringifyShort(value);
      }
    }
  }
}
