import type { Flow, FlowStep, RunContext } from "@/domain/flows/types";
import type { EndpointAuthRole } from "@/src/domain/openapi/endpoints";

/** Minimal endpoint descriptor for request building (no playground imports). */
export type FlowEndpointDescriptor = {
  method: string;
  path: string;
  parameters: Array<{
    name: string;
    in: string;
    required?: boolean;
    schema?: { type?: string; format?: string; enum?: string[]; default?: unknown };
  }>;
  requiresAuth: boolean;
  authRole?: EndpointAuthRole;
};

export type BuiltStepRequest = {
  url: string;
  init: RequestInit;
  requestPreview: string;
  roleUsed: string;
  missingRole: boolean;
};

export type BuildStepRequestInput = {
  step: FlowStep;
  flow: Flow;
  endpoint: FlowEndpointDescriptor;
  ctx: RunContext;
  baseUrl: string;
  credentials: import("./credential-resolver").FlowCredential[];
  defaultCredential: import("./credential-resolver").FlowCredential | null;
};

export type BuildStepRequestResult =
  | { ok: true; request: BuiltStepRequest }
  | { ok: false; error: string };

/** Port: builds HTTP request for a step (implemented outside domain). */
export interface FlowRequestPort {
  buildStepRequest(input: BuildStepRequestInput): BuildStepRequestResult;
}
