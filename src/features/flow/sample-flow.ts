import { linearConnections } from "@/domain/flows/graph";
import {
  createFlowStepFromEndpoint,
  type FlowApiData,
} from "@/features/flow/step-defaults";
import {
  emptyFlow,
  flowEndpointKey,
  type Extraction,
  type Flow,
  type FlowStep,
} from "@/domain/flows/types";
import type { PlaygroundEndpoint } from "@/lib/playground/endpoints";

const LOGIN_PATH_RE = /\/(login|auth|token|sign-?in|session)(\/|$)/i;
const TOKEN_PATH_RE = /(token|accessToken|access_token)/i;

const TOKEN_VAR_CANDIDATES = [
  "accessToken",
  "access_token",
  "token",
  "authToken",
  "jwt",
];

function isLoginEndpoint(ep: PlaygroundEndpoint): boolean {
  const m = ep.method.toUpperCase();
  if (m !== "POST" && m !== "PUT") return false;
  return LOGIN_PATH_RE.test(ep.path);
}

function pickProtectedEndpoint(
  endpoints: PlaygroundEndpoint[],
  loginKey: string
): PlaygroundEndpoint | undefined {
  return endpoints.find(
    (ep) =>
      flowEndpointKey(ep) !== loginKey &&
      ep.requiresAuth &&
      ["GET", "POST", "PUT", "PATCH", "DELETE"].includes(ep.method.toUpperCase())
  );
}

function defaultTokenExtraction(): Extraction {
  return { name: "token", source: "body", path: "accessToken" };
}

function pickTokenVarName(extractions: Extraction[]): string {
  for (const candidate of TOKEN_VAR_CANDIDATES) {
    if (extractions.some((ex) => ex.name.trim() === candidate)) return candidate;
  }
  const first = extractions.find((ex) => ex.name.trim());
  return first?.name.trim() || "token";
}

export type SampleFlowResult =
  | { ok: true; flow: Flow }
  | { ok: false; reason: string };

/**
 * Best-effort sample flow: login-like POST + one protected call with token auth.
 */
export function buildSampleFlow(
  specId: string,
  endpoints: PlaygroundEndpoint[],
  apiData: FlowApiData,
  baseUrl: string
): SampleFlowResult {
  const loginEp = endpoints.find(isLoginEndpoint);
  if (!loginEp) {
    return {
      ok: false,
      reason: "No login-like endpoint found (POST to a path containing login, auth, or token).",
    };
  }

  const loginKey = flowEndpointKey(loginEp);
  const protectedEp = pickProtectedEndpoint(endpoints, loginKey);
  if (!protectedEp) {
    return {
      ok: false,
      reason: "No protected endpoint found to call after login.",
    };
  }

  const loginStep: FlowStep = {
    ...createFlowStepFromEndpoint(loginEp, apiData, baseUrl),
    extractions: [defaultTokenExtraction()],
    credentialName: "No auth",
  };

  const tokenVar = pickTokenVarName(loginStep.extractions);
  loginStep.extractions = loginStep.extractions.map((ex) =>
    ex === loginStep.extractions[0] ? { ...ex, name: tokenVar } : ex
  );

  const secondStep: FlowStep = createFlowStepFromEndpoint(
    protectedEp,
    apiData,
    baseUrl
  );

  const steps = [loginStep, secondStep];
  const flow = emptyFlow(specId, "Example: login then API call");
  return {
    ok: true,
    flow: {
      ...flow,
      description:
        "Sample flow: log in, capture a token, then call a protected endpoint using flow auth.",
      steps,
      connections: linearConnections(steps),
      auth: {
        loginStepId: loginStep.id,
        tokenVar,
        scheme: "bearer",
      },
      onStepFailure: "stop",
    },
  };
}

/** Whether this spec likely supports a generated sample flow. */
export function canBuildSampleFlow(endpoints: PlaygroundEndpoint[]): boolean {
  const loginEp = endpoints.find(isLoginEndpoint);
  if (!loginEp) return false;
  return Boolean(pickProtectedEndpoint(endpoints, flowEndpointKey(loginEp)));
}
