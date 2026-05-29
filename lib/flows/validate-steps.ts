import { extractTokenRefs } from "@/lib/flows/resolve-refs";
import { flowEndpointKey } from "@/lib/flows/types";
import type { FlowStep } from "@/lib/flows/types";
import type { PlaygroundEndpoint } from "@/lib/playground/endpoints";
import { mergeStepFields } from "@/lib/flows/step-defaults";

export type FlowStepIssue = {
  stepIndex: number;
  message: string;
};

const TOKEN_IN_VALUE = /\{\{[^}]+\}\}/;

function collectStrings(step: FlowStep): string[] {
  return [
    ...Object.values(step.paramValues),
    ...Object.values(step.headerValues),
    ...(step.body ? [step.body] : []),
  ];
}

/** Soft warnings before running a flow (does not block execution). */
export function validateFlowSteps(
  steps: FlowStep[],
  endpoints: PlaygroundEndpoint[]
): FlowStepIssue[] {
  const issues: FlowStepIssue[] = [];

  steps.forEach((step, stepIndex) => {
    const endpoint = endpoints.find((e) => flowEndpointKey(e) === step.endpointKey);
    if (!endpoint) {
      issues.push({
        stepIndex,
        message: `Step ${stepIndex + 1}: endpoint not found in spec`,
      });
      return;
    }

    const merged = mergeStepFields(step, endpoint);
    const paramValues = { ...merged.paramValues, ...step.paramValues };

    for (const p of endpoint.parameters) {
      if (p.in !== "path" || !p.required) continue;
      const v = paramValues[p.name]?.trim();
      if (!v) {
        issues.push({
          stepIndex,
          message: `Step ${stepIndex + 1}: required path param "${p.name}" is empty`,
        });
      }
    }

    for (const text of collectStrings(step)) {
      if (!text || !TOKEN_IN_VALUE.test(text)) continue;
      const refs = extractTokenRefs(text);
      const hasUnknown = refs.some((r) => r.kind === "unknown");
      if (hasUnknown) {
        issues.push({
          stepIndex,
          message: `Step ${stepIndex + 1}: contains unrecognized {{...}} reference`,
        });
        break;
      }
      if (stepIndex === 0) {
        for (const r of refs) {
          if (r.kind === "var") {
            issues.push({
              stepIndex,
              message: `Step ${stepIndex + 1}: references {{vars.${r.name}}} but no prior captures exist`,
            });
            break;
          }
          if (
            (r.kind === "stepBody" ||
              r.kind === "stepStatus" ||
              r.kind === "stepHeader") &&
            r.stepIndex >= stepIndex
          ) {
            issues.push({
              stepIndex,
              message: `Step ${stepIndex + 1}: references a later step (step ${r.stepIndex + 1})`,
            });
            break;
          }
        }
      }
    }
  });

  return issues;
}
