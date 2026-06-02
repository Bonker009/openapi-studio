import { AI_DEFAULTS } from "@/domain/ai/config";
import type { FlowSchema } from "@/domain/ai/types";
import type { EndpointCatalogEntry } from "@/domain/ai/validation/endpoint-catalog";
import { validateFlowSchema } from "@/domain/ai/validation/flow-schema-validator";

export type FixFlowFn = (input: {
  invalidFlow: FlowSchema;
  errors: string[];
}) => Promise<FlowSchema>;

export async function runAutoFixLoop(input: {
  initial: FlowSchema;
  catalog: EndpointCatalogEntry[];
  fix: FixFlowFn;
  maxAttempts?: number;
}): Promise<{
  flow: FlowSchema;
  valid: boolean;
  errors: string[];
  attempts: number;
}> {
  const max = input.maxAttempts ?? AI_DEFAULTS.maxFixAttempts;
  let current = input.initial;
  let lastErrors: string[] = [];

  for (let attempt = 1; attempt <= max; attempt++) {
    const result = validateFlowSchema(current, input.catalog);
    if (result.valid) {
      return { flow: current, valid: true, errors: [], attempts: attempt };
    }
    lastErrors = result.errors.map((e) => e.message);
    if (attempt === max) break;
    current = await input.fix({
      invalidFlow: current,
      errors: lastErrors,
    });
  }

  return {
    flow: current,
    valid: false,
    errors: lastErrors,
    attempts: max,
  };
}
