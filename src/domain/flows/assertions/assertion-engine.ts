import type { FlowStepOutcome } from "@/domain/flows/types";

export type AssertionInput = {
  status: number;
  expectedStatus?: number;
  transportError?: string;
  missingRole: boolean;
  roleUsed: string;
};

export type AssertionResult = {
  outcome: FlowStepOutcome;
  error?: string;
};

export class AssertionEngine {
  evaluate(input: AssertionInput): AssertionResult {
    const { status, expectedStatus, transportError, missingRole, roleUsed } =
      input;

    let outcome: FlowStepOutcome;
    let error: string | undefined = transportError;

    if (status === 0) {
      outcome = "error";
      error = transportError ?? "Request failed (no response)";
    } else if (typeof expectedStatus === "number") {
      outcome = status === expectedStatus ? "pass" : "fail";
      if (outcome === "fail") {
        error = `Expected ${expectedStatus}, got ${status}`;
      }
    } else {
      outcome = status >= 200 && status < 400 ? "pass" : "fail";
    }

    if (missingRole) {
      error = error
        ? `${error} (role "${roleUsed}" has no saved credential; ran unauthenticated)`
        : `Role "${roleUsed}" has no saved credential; ran unauthenticated.`;
    }

    return { outcome, error };
  }
}
