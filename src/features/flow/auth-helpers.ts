import type { Extraction, Flow, FlowStep } from "@/domain/flows/types";

const TOKEN_VAR_CANDIDATES = [
  "token",
  "accessToken",
  "access_token",
  "authToken",
  "jwt",
];

export function pickTokenVarFromStep(step: FlowStep): {
  extractions: Extraction[];
  tokenVar: string;
} {
  const extractions = step.extractions;
  for (const candidate of TOKEN_VAR_CANDIDATES) {
    if (extractions.some((ex) => ex.name.trim() === candidate)) {
      return { extractions, tokenVar: candidate };
    }
  }
  const named = extractions.find((ex) => ex.name.trim());
  if (named) return { extractions, tokenVar: named.name.trim() };
  const added: Extraction = {
    name: "token",
    source: "body",
    path: "accessToken",
  };
  return { extractions: [...extractions, added], tokenVar: "token" };
}

/** Mark a step as the flow login and ensure a token capture exists. */
export function setFlowLoginStep(flow: Flow, stepId: string): Flow {
  const step = flow.steps.find((s) => s.id === stepId);
  if (!step) return flow;
  const { extractions, tokenVar } = pickTokenVarFromStep(step);
  const steps = flow.steps.map((s) =>
    s.id === stepId ? { ...s, extractions } : s
  );
  return {
    ...flow,
    steps,
    auth: { loginStepId: stepId, tokenVar, scheme: "bearer" },
  };
}

export type RunAsBulkValue = "__default__" | "__none__" | string;

/** Set the same Run-as auth on every step. */
export function applyRunAsToAll(flow: Flow, value: RunAsBulkValue): Flow {
  const credentialName =
    value === "__default__"
      ? undefined
      : value === "__none__"
        ? "No auth"
        : value;
  const steps = flow.steps.map((s) => ({
    ...s,
    credentialName,
  }));
  return { ...flow, steps };
}

export type StepRoleInfo = {
  label: string;
  isLogin: boolean;
  usesLoginToken: boolean;
};

/** Display label for a step's auth role (builder cards, diagram nodes). */
export function stepRoleLabel(
  step: FlowStep,
  auth?: Flow["auth"]
): StepRoleInfo {
  const isLogin = auth?.loginStepId === step.id;
  const usesLoginToken =
    Boolean(auth?.tokenVar) && !isLogin && !step.credentialName?.trim();

  if (step.credentialName === "No auth") {
    return { label: "No auth", isLogin, usesLoginToken: false };
  }
  if (step.credentialName?.trim()) {
    return {
      label: step.credentialName,
      isLogin,
      usesLoginToken: false,
    };
  }
  if (isLogin) {
    return { label: "Login step", isLogin: true, usesLoginToken: false };
  }
  if (usesLoginToken) {
    return { label: "Login token", isLogin: false, usesLoginToken: true };
  }
  return { label: "Default", isLogin: false, usesLoginToken: false };
}
