import { getByPath } from "@/domain/flows/requests/variable-resolver";
import type { AssertionRule } from "@/domain/flows/types/schema";
import type { AssertionResultDetail } from "@/domain/flows/types/execution-report";

export type AssertionRunInput = {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  legacyExpectedStatus?: number;
};

export function evaluateAssertionRules(
  rules: AssertionRule[],
  input: AssertionRunInput
): AssertionResultDetail[] {
  const results: AssertionResultDetail[] = [];

  for (const rule of rules) {
    results.push(evaluateOne(rule, input));
  }

  if (
    input.legacyExpectedStatus != null &&
    !rules.some((r) => r.type === "status")
  ) {
    results.push(
      evaluateOne(
        { type: "status", equals: input.legacyExpectedStatus },
        input
      )
    );
  }

  return results;
}

function evaluateOne(
  rule: AssertionRule,
  input: AssertionRunInput
): AssertionResultDetail {
  switch (rule.type) {
    case "status": {
      const passed = input.status === rule.equals;
      return {
        rule,
        passed,
        message: passed
          ? undefined
          : `Expected status ${rule.equals}, got ${input.status}`,
      };
    }
    case "statusRange": {
      const passed =
        input.status >= rule.min && input.status <= rule.max;
      return {
        rule,
        passed,
        message: passed
          ? undefined
          : `Expected status ${rule.min}-${rule.max}, got ${input.status}`,
      };
    }
    case "bodyPath": {
      const value = getByPath(input.body, rule.path);
      if (rule.exists) {
        const passed = value !== undefined;
        return {
          rule,
          passed,
          message: passed ? undefined : `Body path "${rule.path}" not found`,
        };
      }
      const passed =
        rule.equals !== undefined
          ? JSON.stringify(value) === JSON.stringify(rule.equals)
          : value !== undefined;
      return {
        rule,
        passed,
        message: passed
          ? undefined
          : `Body path "${rule.path}" mismatch`,
      };
    }
    case "header": {
      const key = Object.keys(input.headers).find(
        (k) => k.toLowerCase() === rule.name.toLowerCase()
      );
      if (rule.exists) {
        const passed = !!key;
        return {
          rule,
          passed,
          message: passed ? undefined : `Header "${rule.name}" missing`,
        };
      }
      const passed = key ? input.headers[key] === rule.equals : false;
      return {
        rule,
        passed,
        message: passed
          ? undefined
          : `Header "${rule.name}" expected "${rule.equals}"`,
      };
    }
    default:
      return { rule, passed: true };
  }
}

export function assertionsPassed(details: AssertionResultDetail[]): boolean {
  return details.every((d) => d.passed);
}
