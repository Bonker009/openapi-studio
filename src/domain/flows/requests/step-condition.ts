import { resolveString, type RunContext } from "./variable-resolver";
import type { ConditionalRule } from "@/domain/flows/types";

export type StepConditionResult = {
  shouldRun: boolean;
  value?: boolean;
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
      value: false,
      reason: `Unresolved condition: ${[...new Set(resolved.missing)].join(", ")}`,
    };
  }

  const normalized = resolved.value.trim().toLowerCase();
  if (FALSY.has(normalized)) {
    return { shouldRun: false, value: false, reason: "Condition is falsy" };
  }

  return { shouldRun: true, value: true };
}

function toNumber(v: string): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function resolveTokenString(input: string, ctx: RunContext): { value: string; missing: string[] } {
  return resolveString(input, ctx);
}

export function evaluateConditionalRule(
  rule: ConditionalRule | undefined,
  ctx: RunContext
): StepConditionResult {
  if (!rule) return { shouldRun: true, value: true };
  const left = resolveTokenString(rule.left, ctx);
  if (left.missing.length > 0) {
    return {
      shouldRun: false,
      value: false,
      reason: `Unresolved conditional left value: ${[...new Set(left.missing)].join(", ")}`,
    };
  }

  const op = rule.operator;
  const leftVal = left.value;
  const rightResolved =
    op === "isTrue" || op === "isFalse" || op === "exists"
      ? { value: "", missing: [] as string[] }
      : resolveTokenString(rule.right ?? "", ctx);

  if (rightResolved.missing.length > 0) {
    return {
      shouldRun: false,
      value: false,
      reason: `Unresolved conditional right value: ${[...new Set(rightResolved.missing)].join(", ")}`,
    };
  }
  const rightVal = rightResolved.value;

  let result = false;
  switch (op) {
    case "equals":
      result = leftVal === rightVal;
      break;
    case "notEquals":
      result = leftVal !== rightVal;
      break;
    case "contains":
      result = leftVal.includes(rightVal);
      break;
    case "notContains":
      result = !leftVal.includes(rightVal);
      break;
    case "gt": {
      const l = toNumber(leftVal);
      const r = toNumber(rightVal);
      result = l !== null && r !== null && l > r;
      break;
    }
    case "gte": {
      const l = toNumber(leftVal);
      const r = toNumber(rightVal);
      result = l !== null && r !== null && l >= r;
      break;
    }
    case "lt": {
      const l = toNumber(leftVal);
      const r = toNumber(rightVal);
      result = l !== null && r !== null && l < r;
      break;
    }
    case "lte": {
      const l = toNumber(leftVal);
      const r = toNumber(rightVal);
      result = l !== null && r !== null && l <= r;
      break;
    }
    case "isTrue":
      result = !FALSY.has(leftVal.trim().toLowerCase());
      break;
    case "isFalse":
      result = FALSY.has(leftVal.trim().toLowerCase());
      break;
    case "exists":
      result = leftVal.trim().length > 0;
      break;
  }

  return {
    shouldRun: result,
    value: result,
    reason: result ? "Condition matched" : "Condition did not match",
  };
}
