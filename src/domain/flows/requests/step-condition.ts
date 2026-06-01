import { resolveString, type RunContext } from "./variable-resolver";

export type StepConditionResult = {
  shouldRun: boolean;
  reason?: string;
};

const FALSY = new Set(["", "false", "0", "no", "null", "undefined"]);

/** Truthy check on a resolved condition string (conditional execution mode). */
export function evaluateStepCondition(
  condition: string | undefined,
  ctx: RunContext
): StepConditionResult {
  if (!condition?.trim()) return { shouldRun: true };

  const resolved = resolveString(condition.trim(), ctx);
  if (resolved.missing.length > 0) {
    return {
      shouldRun: false,
      reason: `Unresolved condition: ${[...new Set(resolved.missing)].join(", ")}`,
    };
  }

  const normalized = resolved.value.trim().toLowerCase();
  if (FALSY.has(normalized)) {
    return { shouldRun: false, reason: "Condition is falsy" };
  }

  return { shouldRun: true };
}
