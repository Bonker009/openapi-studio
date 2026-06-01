import type { AssertionRule } from "./schema";

export type StepRunStatus = "passed" | "failed" | "error" | "skipped";

export type HttpSnapshot = {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
};

export type AssertionResultDetail = {
  rule: AssertionRule;
  passed: boolean;
  message?: string;
};

/** Postman-style per-step execution report (extends legacy fields on {@link StepRunResult}). */
export type StepExecutionReport = {
  stepId: string;
  stepName?: string;
  index: number;
  status: StepRunStatus;
  durationMs: number;
  request?: HttpSnapshot;
  response?: HttpSnapshot & { status?: number; statusText?: string };
  assertions: AssertionResultDetail[];
  capturedVars: Record<string, string>;
  errorMessage?: string;
};
