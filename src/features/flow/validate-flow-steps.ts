import { extractTokenRefs } from "@/domain/flows/requests";
import { orderSteps } from "@/domain/flows/graph";
import { flowEndpointKey } from "@/domain/flows/types";
import type { Flow, FlowStep } from "@/domain/flows/types";
import type { PlaygroundEndpoint } from "@/lib/playground/endpoints";
import { mergeStepFields } from "@/features/flow/step-defaults";

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

function validateFlowAuth(flow: Pick<Flow, "steps" | "auth">): FlowStepIssue[] {
  const issues: FlowStepIssue[] = [];
  const auth = flow.auth;
  if (!auth?.loginStepId || !auth.tokenVar?.trim()) return issues;

  const loginStep = flow.steps.find((s) => s.id === auth.loginStepId);
  if (!loginStep) {
    issues.push({
      stepIndex: 0,
      message: "Flow auth: login step no longer exists in this flow",
    });
    return issues;
  }

  const loginIndex = orderSteps(flow as Flow).findIndex(
    (s) => s.id === auth.loginStepId
  );
  const hasCapture = loginStep.extractions.some(
    (ex) => ex.name.trim() === auth.tokenVar.trim()
  );
  if (!hasCapture) {
    issues.push({
      stepIndex: Math.max(0, loginIndex),
      message: `Flow auth: login step has no capture named "${auth.tokenVar}"`,
    });
  }

  if (loginIndex > 0) {
    const ordered = orderSteps(flow as Flow);
    for (let i = 0; i < loginIndex; i++) {
      const step = ordered[i];
      if (step.credentialName === "No auth") continue;
      const usesFlowDefault = !step.credentialName?.trim();
      if (usesFlowDefault) {
        issues.push({
          stepIndex: i,
          message: `Step ${i + 1} runs before the login step but uses Flow default auth (expects a token not yet captured)`,
        });
      }
    }
  }

  return issues;
}

/** Soft warnings before running a flow (does not block execution). */
export function validateFlowSteps(
  flow: Pick<Flow, "steps" | "auth" | "connections">,
  endpoints: PlaygroundEndpoint[]
): FlowStepIssue[] {
  const issues: FlowStepIssue[] = [...validateFlowAuth(flow)];
  const steps = flow.steps;

  steps.forEach((step, stepIndex) => {
    if (step.stepKind === "conditional") {
      if (!step.conditional?.left?.trim()) {
        issues.push({
          stepIndex,
          message: `Step ${stepIndex + 1}: conditional left value is required`,
        });
      }
      const outgoing =
        (flow.connections ?? []).filter((c) => c.source === step.id) ?? [];
      const trueCount = outgoing.filter((c) => (c.kind ?? "seq") === "true").length;
      const falseCount = outgoing.filter((c) => (c.kind ?? "seq") === "false").length;
      if (trueCount !== 1 || falseCount !== 1) {
        issues.push({
          stepIndex,
          message: `Step ${stepIndex + 1}: conditional step should have one true and one false connection`,
        });
      }
      return;
    }

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
