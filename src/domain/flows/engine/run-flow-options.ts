import type { FlowExecutor } from "./http-types";
import type { FlowRequestPort } from "@/domain/flows/requests/request-port";
import type { FlowCredential } from "@/domain/flows/requests/credential-resolver";
import type { FlowEndpointDescriptor } from "@/domain/flows/requests/request-port";
import type { Flow, RunContext, StepRunResult } from "@/domain/flows/types";
import type { FlowEnvironment } from "@/domain/flows/types/schema";
import type { PauseHandler } from "./pause-controller";

export type RunFlowOptions = {
  flow: Flow;
  endpoints: FlowEndpointDescriptor[];
  baseUrl: string;
  credentials: FlowCredential[];
  defaultCredential: FlowCredential | null;
  requestPort: FlowRequestPort;
  execute: FlowExecutor;
  /** Active environment merged into {{env.*}} resolution. */
  environment?: FlowEnvironment | Record<string, unknown>;
  signal?: AbortSignal;
  onProgress?: (result: StepRunResult, index: number, total: number) => void;
  startIndex?: number;
  seedContext?: RunContext;
  priorResults?: StepRunResult[];
  stepThrough?: boolean;
  onPause?: PauseHandler;
};

export function resolveEnvironmentRecord(
  opts: RunFlowOptions
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    baseUrl: opts.flow.baseUrl ?? opts.baseUrl,
  };
  if (opts.environment) {
    if ("variables" in opts.environment && opts.environment.variables) {
      Object.assign(base, opts.environment.variables);
    }
    if ("baseUrl" in opts.environment && opts.environment.baseUrl) {
      base.baseUrl = opts.environment.baseUrl;
    }
    if (!("variables" in opts.environment)) {
      Object.assign(base, opts.environment);
    }
  }
  const flowEnv = opts.flow.environment;
  if (flowEnv && typeof flowEnv === "object" && "variables" in flowEnv) {
    Object.assign(base, flowEnv.variables);
    if (flowEnv.baseUrl) base.baseUrl = flowEnv.baseUrl;
  }
  return base;
}
