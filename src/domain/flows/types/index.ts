export * from "./schema";
export * from "./execution-report";

import type { FlowEnvironment, FlowExecutionMode, StepUiMeta } from "./schema";
import type {
  AssertionResultDetail,
  HttpSnapshot,
  StepRunStatus,
} from "./execution-report";

/** Where to read a captured value from a step's response. */
export type ExtractionSource = "body" | "headers" | "status";

/** Capture a value from a step response into a named variable. */
export type Extraction = {
  name: string;
  source: ExtractionSource;
  path: string;
};

export type FlowStep = {
  id: string;
  /** Human-readable label (defaults from summary/operationId in UI). */
  name?: string;
  endpointKey: string;
  paramValues: Record<string, string>;
  headerValues: Record<string, string>;
  body?: string;
  extractions: Extraction[];
  expectedStatus?: number;
  credentialName?: string;
  pauseAfter?: boolean;
  delayMs?: number;
  retry?: { count: number; delayMs: number };
  ui?: StepUiMeta;
  /** Conditional mode: skip step when resolved expression is falsy. */
  condition?: string;
};

export type FlowFailurePolicy = "stop" | "continue";

export type FlowConnection = { source: string; target: string };

export type DiagramPosition = { x: number; y: number };

export type FlowAuth = {
  loginStepId: string;
  tokenVar: string;
  scheme?: "bearer";
};

export type Flow = {
  id: string;
  specId: string;
  name: string;
  description?: string;
  /** Preferred base URL for this flow (overrides playground env when set). */
  baseUrl?: string;
  variables?: Record<string, string>;
  environment?: FlowEnvironment | string;
  executionMode?: FlowExecutionMode;
  steps: FlowStep[];
  auth?: FlowAuth;
  onStepFailure: FlowFailurePolicy;
  connections?: FlowConnection[];
  diagramPositions?: Record<string, DiagramPosition>;
  createdAt: number;
  updatedAt: number;
};

export type FlowStepOutcome = "pass" | "fail" | "error" | "skipped";

export type StepResponse = {
  status: number;
  statusText?: string;
  headers: Record<string, string>;
  body: unknown;
};

export type RunContext = {
  vars: Record<string, unknown>;
  /** Flow-level and user-defined globals. */
  global: Record<string, unknown>;
  /** Active environment variables (baseUrl, tokens, etc.). */
  env: Record<string, unknown>;
  steps: (StepResponse | undefined)[];
  /** Maps declarative step name -> execution index. */
  stepIndexByName: Record<string, number>;
};

export type StepRunResult = {
  stepId: string;
  stepName?: string;
  index: number;
  endpointKey: string;
  method: string;
  path: string;
  outcome: FlowStepOutcome;
  /** Postman-style status label. */
  runStatus?: StepRunStatus;
  status: number;
  statusText?: string;
  latencyMs: number;
  resolvedUrl?: string;
  requestPreview?: string;
  responseBodyPreview?: string;
  request?: HttpSnapshot;
  response?: HttpSnapshot & { status?: number; statusText?: string };
  assertions?: AssertionResultDetail[];
  capturedVars: Record<string, string>;
  roleUsed?: string;
  responseBody?: unknown;
  error?: string;
  errorMessage?: string;
};

export type FlowRunResult = {
  steps: StepRunResult[];
  startedAt: number;
  finishedAt: number;
  outcome: FlowStepOutcome;
  context?: RunContext;
};

export const MAX_FLOW_STEPS = 25;

export function newFlowId(): string {
  return `flow-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function newStepId(): string {
  return `step-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function flowEndpointKey(ep: { method: string; path: string }): string {
  return `${ep.method.toUpperCase()}:${ep.path}`;
}

export const DIAGRAM_NODE_W = 220;
export const DIAGRAM_NODE_H = 76;
export const DIAGRAM_ROW_GAP = 48;

export function defaultDiagramPosition(index: number): DiagramPosition {
  return { x: 80, y: index * (DIAGRAM_NODE_H + DIAGRAM_ROW_GAP) };
}

export function createRunContext(seed?: Partial<RunContext>): RunContext {
  return {
    vars: { ...(seed?.vars ?? {}) },
    global: { ...(seed?.global ?? {}) },
    env: { ...(seed?.env ?? {}) },
    steps: [...(seed?.steps ?? [])],
    stepIndexByName: { ...(seed?.stepIndexByName ?? {}) },
  };
}

export function emptyFlow(specId: string, name = "Untitled flow"): Flow {
  const now = Date.now();
  return {
    id: newFlowId(),
    specId,
    name,
    description: "",
    steps: [],
    onStepFailure: "stop",
    createdAt: now,
    updatedAt: now,
  };
}
