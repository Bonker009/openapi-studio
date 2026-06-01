import { extractTokenRefs } from "@/domain/flows/requests/variable-resolver";
import type { FlowDefinition, DeclarativeStep } from "@/domain/flows/types/schema";
import type { Flow, FlowStep } from "@/domain/flows/types";

export type FlowValidationIssue = {
  stepIndex: number;
  stepId?: string;
  field?: string;
  message: string;
  severity: "error" | "warning";
};

function collectStringsFromStep(step: FlowStep): string[] {
  return [
    ...Object.values(step.paramValues),
    ...Object.values(step.headerValues),
    ...(step.body ? [step.body] : []),
  ];
}

function collectStringsFromDeclarative(step: DeclarativeStep): string[] {
  const parts: string[] = [step.request.url];
  if (step.request.body != null) {
    parts.push(
      typeof step.request.body === "string"
        ? step.request.body
        : JSON.stringify(step.request.body)
    );
  }
  for (const h of Object.values(step.request.headers ?? {})) parts.push(h);
  for (const q of Object.values(step.request.query ?? {})) parts.push(q);
  return parts;
}

function validateTokens(
  texts: string[],
  stepIndex: number,
  stepId: string
): FlowValidationIssue[] {
  const issues: FlowValidationIssue[] = [];
  for (const text of texts) {
    for (const ref of extractTokenRefs(text)) {
      if (ref.kind === "unknown") {
        issues.push({
          stepIndex,
          stepId,
          message: `Unrecognized token ${ref.raw}`,
          severity: "error",
        });
      }
    }
  }
  return issues;
}

/** Validate declarative flow document before execution. */
export function validateFlowDefinition(
  def: FlowDefinition
): FlowValidationIssue[] {
  const issues: FlowValidationIssue[] = [];

  if (!def.baseUrl?.trim()) {
    issues.push({
      stepIndex: 0,
      field: "baseUrl",
      message: "Flow baseUrl is required",
      severity: "error",
    });
  }

  if (!def.steps.length) {
    issues.push({
      stepIndex: 0,
      message: "Flow has no steps",
      severity: "warning",
    });
  }

  def.steps.forEach((step, stepIndex) => {
    if (!step.name?.trim()) {
      issues.push({
        stepIndex,
        stepId: step.id,
        field: "name",
        message: "Step should have a name for readability",
        severity: "warning",
      });
    }
    if (!step.request.url?.trim()) {
      issues.push({
        stepIndex,
        stepId: step.id,
        field: "request.url",
        message: "Request URL is required",
        severity: "error",
      });
    }
    try {
      if (step.request.url.startsWith("http")) {
        new URL(step.request.url);
      }
    } catch {
      issues.push({
        stepIndex,
        stepId: step.id,
        field: "request.url",
        message: "Request URL is not valid",
        severity: "error",
      });
    }
    issues.push(
      ...validateTokens(collectStringsFromDeclarative(step), stepIndex, step.id)
    );
  });

  return issues;
}

/** Validate legacy flow (wraps existing checks + schema hints). */
export function validateLegacyFlowSchema(
  flow: Pick<Flow, "steps" | "baseUrl" | "auth">
): FlowValidationIssue[] {
  const issues: FlowValidationIssue[] = [];
  flow.steps.forEach((step, stepIndex) => {
    issues.push(
      ...validateTokens(collectStringsFromStep(step), stepIndex, step.id)
    );
  });
  return issues;
}

export function hasBlockingIssues(issues: FlowValidationIssue[]): boolean {
  return issues.some((i) => i.severity === "error");
}
