import type { Flow } from "@/domain/flows/types";

export type FlowNodeType = "REQUEST";

export type FlowEdgeType = "success" | "failure" | "always";

export type FlowSchemaNode = {
  id: string;
  type: FlowNodeType;
  name: string;
  endpoint: string;
};

export type FlowSchemaEdge = {
  from: string;
  to: string;
  type: FlowEdgeType;
};

/** External AI contract (strict nodes/edges). */
export type FlowSchema = {
  nodes: FlowSchemaNode[];
  edges: FlowSchemaEdge[];
};

export type FlowPlanStep = {
  order: number;
  action: string;
  endpoint?: string;
  notes?: string;
};

export type FlowGenerationPlan = {
  intent: string;
  steps: FlowPlanStep[];
};

export type RetrievedChunk = {
  id: string;
  chunkType: "endpoint" | "schema" | "auth";
  endpointKey?: string;
  /** Primary OpenAPI tag / controller label when indexed. */
  controller?: string;
  title: string;
  content: string;
  score: number;
};

export type ValidationIssue = {
  code: string;
  message: string;
  path?: string;
};

export type FlowValidationResult = {
  valid: boolean;
  errors: ValidationIssue[];
};

export type GenerateFlowInput = {
  specId: string;
  userIntent?: string;
  baseUrl?: string;
  conversationId?: string;
};

export type GenerateFlowOutput = {
  flowSchema: FlowSchema;
  plan: FlowGenerationPlan;
  internalFlow: Flow;
  retrievedChunks: RetrievedChunk[];
  attempts: number;
  cached: boolean;
};

export type QAInput = {
  specId: string;
  question: string;
  conversationId?: string;
};

export type QAOutput = {
  answer: string;
  retrievedChunks: RetrievedChunk[];
  citedEndpoints: string[];
};

export type DiffInput = {
  specId: string;
  beforeSummary: string;
  afterSummary: string;
};

export type IndexOpenApiInput = {
  specId: string;
  force?: boolean;
};

export type IndexOpenApiResult = {
  specId: string;
  chunkCount: number;
  endpointCount: number;
  indexedAt: number;
};
