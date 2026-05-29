import type { RunContext } from "@/lib/flows/resolve-refs";

/** Where to read a captured value from a step's response. */
export type ExtractionSource = "body" | "headers" | "status";

/** Capture a value from a step response into a named variable. */
export type Extraction = {
  /** Variable name referenced later as {{vars.NAME}}. */
  name: string;
  source: ExtractionSource;
  /** Dot/bracket path, e.g. "data[0].id" (ignored for status). */
  path: string;
};

/** A single endpoint invocation in a flow. */
export type FlowStep = {
  id: string;
  /** `METHOD:/path` — matches PlaygroundEndpoint via endpointKey(). */
  endpointKey: string;
  /** Path/query param values; may contain {{...}} tokens. */
  paramValues: Record<string, string>;
  /** Header values; may contain {{...}} tokens. */
  headerValues: Record<string, string>;
  /** JSON request body as text; may contain {{...}} tokens. */
  body?: string;
  /** Values captured from this step's response. */
  extractions: Extraction[];
  /** Optional assertion: response must equal this status to pass. */
  expectedStatus?: number;
  /** Saved credential name to run this step as (role). Empty = flow default. */
  credentialName?: string;
  /** Pause after this step during an interactive run to capture live data. */
  pauseAfter?: boolean;
};

export type FlowFailurePolicy = "stop" | "continue";

/** A directed wiring between two steps on the canvas (by step id). */
export type FlowConnection = { source: string; target: string };

/** Diagram node position (visual layout only; does not change step order). */
export type DiagramPosition = { x: number; y: number };

/** A saved, ordered chain of endpoint calls. */
export type Flow = {
  id: string;
  specId: string;
  name: string;
  description?: string;
  steps: FlowStep[];
  /** Behaviour when a step fails/errors. Default "stop". */
  onStepFailure: FlowFailurePolicy;
  /** Optional explicit canvas wiring; defines run order when present. */
  connections?: FlowConnection[];
  /** Optional React Flow layout keyed by step id. */
  diagramPositions?: Record<string, DiagramPosition>;
  createdAt: number;
  updatedAt: number;
};

export type FlowStepOutcome = "pass" | "fail" | "error" | "skipped";

/** Result of running a single step. */
export type StepRunResult = {
  stepId: string;
  index: number;
  endpointKey: string;
  method: string;
  path: string;
  outcome: FlowStepOutcome;
  status: number;
  statusText?: string;
  latencyMs: number;
  resolvedUrl?: string;
  requestPreview?: string;
  responseBodyPreview?: string;
  /** Variables captured by this step (name -> stringified value). */
  capturedVars: Record<string, string>;
  /** Role/credential name actually used for this step. */
  roleUsed?: string;
  /** Parsed response body (in-memory only; used by the payload picker). */
  responseBody?: unknown;
  error?: string;
};

export type FlowRunResult = {
  steps: StepRunResult[];
  startedAt: number;
  finishedAt: number;
  /** Overall: pass only if every non-skipped step passed. */
  outcome: FlowStepOutcome;
  /** Final run context (vars + step responses); used to resume a later run. */
  context?: RunContext;
};

export const MAX_FLOW_STEPS = 25;

export function newFlowId(): string {
  return `flow-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function newStepId(): string {
  return `step-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Stable key matching PlaygroundEndpoint, e.g. "GET:/products/{id}". */
export function flowEndpointKey(ep: { method: string; path: string }): string {
  return `${ep.method.toUpperCase()}:${ep.path}`;
}

export const DIAGRAM_NODE_W = 220;
export const DIAGRAM_NODE_H = 76;
export const DIAGRAM_ROW_GAP = 48;

export function defaultDiagramPosition(index: number): DiagramPosition {
  return { x: 80, y: index * (DIAGRAM_NODE_H + DIAGRAM_ROW_GAP) };
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
