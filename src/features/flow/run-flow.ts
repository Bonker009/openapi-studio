import {
  runFlow as runFlowEngine,
  flowLoginCredential,
} from "@/domain/flows/engine";
import type {
  FlowExecutor as DomainFlowExecutor,
  RunFlowOptions as DomainRunFlowOptions,
} from "@/domain/flows/engine";
import type { FlowRequestPort } from "@/domain/flows/requests/request-port";
import type { FlowCredential } from "@/domain/flows/requests/credential-resolver";
import type { FlowEndpointDescriptor } from "@/domain/flows/requests/request-port";
import { createPlaygroundRequestPort } from "@/infrastructure/flows/playground-request-port";
import type { Credential } from "@/lib/playground/credentials";
import { ensureFreshCredential } from "@/lib/playground/token-lifecycle";
import type { PlaygroundEndpoint } from "@/lib/playground/endpoints";
import type { HttpRequestResult } from "@/lib/playground/http-request-core";

export type FlowExecutor = (
  url: string,
  init: RequestInit
) => Promise<HttpRequestResult>;

export type RunFlowOptions = Omit<
  DomainRunFlowOptions,
  "requestPort" | "endpoints" | "credentials" | "defaultCredential" | "execute"
> & {
  endpoints: PlaygroundEndpoint[];
  credentials: Credential[];
  defaultCredential: Credential | null;
  execute: FlowExecutor;
  requestPort?: FlowRequestPort;
  specId?: string;
  onCredentialRefresh?: (credential: Credential) => void;
};

function mapEndpoint(ep: PlaygroundEndpoint): FlowEndpointDescriptor {
  return {
    method: ep.method,
    path: ep.path,
    parameters: ep.parameters,
    requiresAuth: ep.requiresAuth,
    authRole: ep.authRole,
  };
}

function mapCredential(c: Credential): FlowCredential {
  return { ...(c as FlowCredential) };
}

const domainExecutor =
  (execute: FlowExecutor): DomainFlowExecutor =>
  async (url, init) => {
    const res = await execute(url, init);
    return {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
      data: res.data,
      error: res.error,
    };
  };

export async function runFlow(opts: RunFlowOptions) {
  const prepareStep = opts.specId
    ? async (state: {
        credentials: FlowCredential[];
        defaultCredential: FlowCredential | null;
      }) => {
        const current = opts.credentials.find(
          (c) => c.id === state.defaultCredential?.id
        );
        if (!current) return;
        const fresh = await ensureFreshCredential(opts.specId!, current);
        if (!fresh.refreshed || !fresh.credential) return;
        const mapped = mapCredential(fresh.credential);
        state.defaultCredential = mapped;
        state.credentials = state.credentials.map((c) =>
          c.id === mapped.id ? mapped : c
        );
        opts.onCredentialRefresh?.(fresh.credential);
      }
    : undefined;

  return runFlowEngine({
    flow: opts.flow,
    baseUrl: opts.baseUrl,
    signal: opts.signal,
    onProgress: opts.onProgress,
    startIndex: opts.startIndex,
    seedContext: opts.seedContext,
    priorResults: opts.priorResults,
    stepThrough: opts.stepThrough,
    onPause: opts.onPause,
    prepareStep,
    requestPort: opts.requestPort ?? createPlaygroundRequestPort(),
    endpoints: opts.endpoints.map(mapEndpoint),
    credentials: opts.credentials.map(mapCredential),
    defaultCredential: opts.defaultCredential
      ? mapCredential(opts.defaultCredential)
      : null,
    execute: domainExecutor(opts.execute),
  });
}

export { flowLoginCredential };
export type {
  PauseInfo,
  PauseDecision,
} from "@/domain/flows/engine/pause-controller";
