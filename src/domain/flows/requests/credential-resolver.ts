import type { Flow, FlowStep, RunContext } from "@/domain/flows/types";

export type FlowCredential = {
  id: string;
  name: string;
  type: string;
  token?: string;
};

const FLOW_LOGIN_CREDENTIAL_ID = "__flow_login__";
const FLOW_LOGIN_ROLE = "Login token";

export function flowLoginCredential(
  flow: Flow,
  ctx: RunContext
): FlowCredential | null {
  const auth = flow.auth;
  if (!auth?.tokenVar) return null;
  const token = ctx.vars[auth.tokenVar];
  if (token == null || token === "") return null;
  return {
    id: FLOW_LOGIN_CREDENTIAL_ID,
    name: FLOW_LOGIN_ROLE,
    type: "bearer",
    token: String(token),
  };
}

export type CredentialResolution = {
  credential: FlowCredential | null;
  roleUsed: string;
  missingRole: boolean;
};

export function resolveFlowCredential(
  step: FlowStep,
  flow: Flow,
  ctx: RunContext,
  credentials: FlowCredential[],
  defaultCredential: FlowCredential | null
): CredentialResolution {
  const name = step.credentialName?.trim();
  if (!name || name === "No auth") {
    if (name === "No auth") {
      return { credential: null, roleUsed: "No auth", missingRole: false };
    }
    const isLoginStep = flow.auth?.loginStepId === step.id;
    const loginCred = !isLoginStep ? flowLoginCredential(flow, ctx) : null;
    if (loginCred) {
      return {
        credential: loginCred,
        roleUsed: FLOW_LOGIN_ROLE,
        missingRole: false,
      };
    }
    return {
      credential: defaultCredential,
      roleUsed: defaultCredential?.name ?? "No auth",
      missingRole: false,
    };
  }
  const match = credentials.find((c) => c.name === name);
  if (!match) {
    return { credential: null, roleUsed: name, missingRole: true };
  }
  return { credential: match, roleUsed: match.name, missingRole: false };
}
