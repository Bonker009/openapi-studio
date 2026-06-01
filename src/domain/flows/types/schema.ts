/**
 * Postman / OpenAPI-style declarative flow schema (v2).
 * Legacy {@link Flow} / {@link FlowStep} remain the persisted format; use adapters to convert.
 */

export type FlowEnvironmentName = "dev" | "staging" | "prod" | (string & {});

export type FlowEnvironment = {
  id?: string;
  name: string;
  baseUrl: string;
  variables: Record<string, string>;
};

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "HEAD"
  | "OPTIONS";

export type DeclarativeRequest = {
  method: HttpMethod;
  /** Absolute or path-relative URL; supports {{env.*}} / {{vars.*}} tokens. */
  url: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
};

export type DeclarativeAuth = {
  type: "bearer" | "apiKey" | "basic" | "none";
  token?: string;
  key?: string;
  username?: string;
  password?: string;
  headerName?: string;
};

export type ExtractionRule = {
  name: string;
  source: "body" | "headers" | "status";
  path: string;
};

export type AssertionRule =
  | { type: "status"; equals: number }
  | { type: "statusRange"; min: number; max: number }
  | { type: "bodyPath"; path: string; equals?: unknown; exists?: boolean }
  | { type: "header"; name: string; equals?: string; exists?: boolean };

export type StepRetry = {
  count: number;
  delayMs: number;
};

export type StepPreRequest = {
  setHeaders?: Record<string, string>;
  /** Reserved: script id or expression name for future sandbox. */
  computeVars?: string;
};

export type StepPostRequest = {
  /** Map response JSON paths to variable names, e.g. { "data.token": "token" } */
  saveVars?: Record<string, string>;
};

export type StepUiMeta = {
  color?: string;
  icon?: string;
  group?: string;
};

/** Declarative step (Postman-like). */
export type DeclarativeStep = {
  id: string;
  name: string;
  request: DeclarativeRequest;
  auth?: DeclarativeAuth;
  extract?: ExtractionRule[];
  assert?: AssertionRule[];
  retry?: StepRetry;
  delayMs?: number;
  preRequest?: StepPreRequest;
  postRequest?: StepPostRequest;
  pauseAfter?: boolean;
  ui?: StepUiMeta;
};

export type FlowExecutionMode = "sequential" | "parallel" | "conditional";

/** OpenAPI-style flow document. */
export type FlowDefinition = {
  id: string;
  name: string;
  description?: string;
  specId?: string;
  baseUrl: string;
  variables?: Record<string, string>;
  environment?: FlowEnvironmentName | FlowEnvironment;
  executionMode?: FlowExecutionMode;
  steps: DeclarativeStep[];
  onStepFailure?: "stop" | "continue";
  connections?: { source: string; target: string }[];
  diagramPositions?: Record<string, { x: number; y: number }>;
  auth?: {
    loginStepId: string;
    tokenVar: string;
    scheme?: "bearer";
  };
  createdAt?: number;
  updatedAt?: number;
};

export type FlowCollection = {
  id: string;
  name: string;
  description?: string;
  flows: FlowDefinition[];
};
