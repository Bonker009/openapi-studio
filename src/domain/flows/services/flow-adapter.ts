import type {
  AssertionRule,
  DeclarativeStep,
  ExtractionRule,
  FlowDefinition,
  FlowEnvironment,
  HttpMethod,
} from "@/domain/flows/types/schema";
import type { Extraction, Flow, FlowStep } from "@/domain/flows/types";
import { flowEndpointKey as endpointKey } from "@/domain/flows/types";

function extractionsToRules(extractions: Extraction[]): ExtractionRule[] {
  return extractions.map((ex) => ({
    name: ex.name,
    source: ex.source,
    path: ex.path,
  }));
}

function rulesToExtractions(rules: ExtractionRule[]): Extraction[] {
  return rules.map((r) => ({
    name: r.name,
    source: r.source,
    path: r.path,
  }));
}

/** Convert persisted legacy flow → declarative schema (for export / UI builder). */
export function legacyFlowToDefinition(
  flow: Flow,
  baseUrl: string
): FlowDefinition {
  const env =
    typeof flow.environment === "object"
      ? flow.environment
      : flow.environment
        ? ({ name: String(flow.environment), baseUrl, variables: {} } satisfies FlowEnvironment)
        : undefined;

  return {
    id: flow.id,
    name: flow.name,
    description: flow.description,
    specId: flow.specId,
    baseUrl: flow.baseUrl ?? baseUrl,
    variables: flow.variables,
    environment: env,
    executionMode: flow.executionMode ?? "sequential",
    onStepFailure: flow.onStepFailure,
    connections: flow.connections,
    diagramPositions: flow.diagramPositions,
    auth: flow.auth,
    createdAt: flow.createdAt,
    updatedAt: flow.updatedAt,
    steps: flow.steps.map((step) => legacyStepToDeclarative(step, baseUrl)),
  };
}

export function legacyStepToDeclarative(
  step: FlowStep,
  baseUrl: string
): DeclarativeStep {
  const [method, ...pathParts] = step.endpointKey.split(":");
  const path = pathParts.join(":");
  const url = path.startsWith("http") ? path : `${baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;

  const assert: AssertionRule[] = [];
  if (typeof step.expectedStatus === "number") {
    assert.push({ type: "status", equals: step.expectedStatus });
  }

  return {
    id: step.id,
    name: step.name ?? `${method} ${path}`,
    request: {
      method: (method?.toUpperCase() ?? "GET") as HttpMethod,
      url,
      headers: step.headerValues,
      query: step.paramValues,
      body: step.body ? tryParseJson(step.body) : undefined,
    },
    extract: extractionsToRules(step.extractions),
    assert: assert.length ? assert : undefined,
    retry: step.retry,
    delayMs: step.delayMs,
    pauseAfter: step.pauseAfter,
    ui: step.ui,
  };
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Convert declarative schema → legacy persisted flow (SQLite / API). */
export function definitionToLegacyFlow(def: FlowDefinition): Flow {
  const now = Date.now();
  return {
    id: def.id,
    specId: def.specId ?? "",
    name: def.name,
    description: def.description,
    baseUrl: def.baseUrl,
    variables: def.variables,
    environment: def.environment,
    executionMode: def.executionMode,
    steps: def.steps.map(declarativeStepToLegacy),
    auth: def.auth,
    onStepFailure: def.onStepFailure ?? "stop",
    connections: def.connections,
    diagramPositions: def.diagramPositions,
    createdAt: def.createdAt ?? now,
    updatedAt: def.updatedAt ?? now,
  };
}

export function declarativeStepToLegacy(step: DeclarativeStep): FlowStep {
  const url = step.request.url;
  let endpointKeyStr = `${step.request.method}:${url}`;
  try {
    const parsed = new URL(url, "http://placeholder.local");
    endpointKeyStr = `${step.request.method}:${parsed.pathname}`;
  } catch {
    /* keep full url in key */
  }

  const statusAssert = step.assert?.find((a) => a.type === "status");
  const expectedStatus =
    statusAssert && statusAssert.type === "status"
      ? statusAssert.equals
      : undefined;

  return {
    id: step.id,
    name: step.name,
    endpointKey: endpointKeyStr,
    paramValues: step.request.query ?? {},
    headerValues: step.request.headers ?? {},
    body:
      step.request.body != null
        ? typeof step.request.body === "string"
          ? step.request.body
          : JSON.stringify(step.request.body)
        : undefined,
    extractions: rulesToExtractions(step.extract ?? []),
    expectedStatus,
    pauseAfter: step.pauseAfter,
    delayMs: step.delayMs,
    retry: step.retry,
    ui: step.ui,
  };
}

/** Build endpoint key from playground endpoint + declarative step name. */
export function endpointKeyFromPlayground(ep: {
  method: string;
  path: string;
}): string {
  return endpointKey(ep);
}
