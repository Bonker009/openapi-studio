import { defaultParamValues } from "@/lib/playground/build-request";
import type { PlaygroundEndpoint } from "@/lib/playground/endpoints";
import { generateOpenApiSample } from "@/lib/playground/generate-sample";
import {
  getRequestBodyInfo,
  pickRequestBodyContent,
} from "@/lib/playground/request-body";
import { getRequestBodySchema } from "@/lib/openapi-schema";
import { generateBodyValidationCases } from "@/lib/validation/case-generator-body";
import { generateHeaderValidationCases } from "@/lib/validation/case-generator-headers";
import { generateParamValidationCases } from "@/lib/validation/case-generator-params";
import {
  applyOverridesToBody,
  applyOverridesToHeaders,
  applyOverridesToParams,
  resolveOverridesForEndpoint,
} from "@/lib/validation/overrides";
import type {
  EndpointValidationSuite,
  ValidationCase,
  ValidationCaseDraft,
  ValidationOverridesStore,
  ValidationSuiteConfig,
} from "@/lib/validation/types";
import { endpointKey } from "@/lib/validation/types";
import { deepClone } from "@/lib/validation/utils";

function getOperation(
  apiData: { paths?: Record<string, unknown> },
  path: string,
  method: string
): Record<string, unknown> | null {
  const pathItem = apiData.paths?.[path] as Record<string, unknown> | undefined;
  if (!pathItem || typeof pathItem !== "object") return null;
  const op = pathItem[method.toLowerCase()];
  if (!op || typeof op !== "object") return null;
  return op as Record<string, unknown>;
}

function buildBaselineHeaders(
  parameters: PlaygroundEndpoint["parameters"]
): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  for (const p of parameters) {
    if (p.in !== "header") continue;
    if (p.schema?.default != null) {
      headers[p.name] = String(p.schema.default);
    } else if (p.required) {
      headers[p.name] = p.schema?.type === "integer" ? "1" : "value";
    }
  }
  return headers;
}

function assignCaseIds(cases: ValidationCase[]): ValidationCase[] {
  return cases.map((c, i) => ({
    ...c,
    id: `${c.endpointKey}:${c.category}:${c.fieldPath}:${c.variant}:${i}`,
  }));
}

function capCases(
  cases: ValidationCase[],
  cap: number
): ValidationCase[] {
  if (cases.length <= cap) return cases;
  const baseline = cases.filter((c) => c.isBaseline);
  const rest = cases.filter((c) => !c.isBaseline);
  const remaining = Math.max(0, cap - baseline.length);
  return [...baseline, ...rest.slice(0, remaining)];
}

export function buildEndpointValidationSuite(
  endpoint: PlaygroundEndpoint,
  apiData: {
    paths?: Record<string, unknown>;
    components?: unknown;
  },
  store: ValidationOverridesStore,
  config: ValidationSuiteConfig
): EndpointValidationSuite {
  const overrides = resolveOverridesForEndpoint(store, endpointKey(endpoint));
  const op = getOperation(apiData, endpoint.path, endpoint.method);
  if (!op) {
    return {
      endpoint,
      cases: [],
      skippedReason: "Operation not found in spec",
    };
  }

  const bodyInfo = getRequestBodyInfo(op, apiData.components);
  if (bodyInfo.kind === "multipart" || bodyInfo.kind === "binary") {
    return {
      endpoint,
      cases: [],
      skippedReason: bodyInfo.kind,
    };
  }

  const baselineParams = applyOverridesToParams(
    defaultParamValues(endpoint.parameters),
    overrides
  );
  const baselineHeaders = applyOverridesToHeaders(
    buildBaselineHeaders(endpoint.parameters),
    overrides
  );

  let baselineBody: Record<string, unknown> | undefined;
  const upper = endpoint.method.toUpperCase();
  if (
    endpoint.hasRequestBody &&
    bodyInfo.kind === "json" &&
    upper !== "GET" &&
    upper !== "HEAD"
  ) {
    const schema = getRequestBodySchema(op);
    const sample = schema
      ? generateOpenApiSample(schema, apiData.components)
      : null;
    if (sample && typeof sample === "object" && !Array.isArray(sample)) {
      baselineBody = applyOverridesToBody(
        sample as Record<string, unknown>,
        overrides
      );
    } else if (sample != null) {
      baselineBody = { value: sample } as Record<string, unknown>;
    }
  } else if (endpoint.hasRequestBody && op.requestBody) {
    const content = (op.requestBody as { content?: Record<string, unknown> })
      .content;
    const picked = pickRequestBodyContent(
      content as Record<string, { schema?: unknown }> | undefined
    );
    if (picked?.mediaType.includes("multipart")) {
      return { endpoint, cases: [], skippedReason: "multipart" };
    }
    if (picked?.mediaType.includes("octet-stream")) {
      return { endpoint, cases: [], skippedReason: "binary" };
    }
  }

  const ek = endpointKey(endpoint);
  const partials: ValidationCaseDraft[] = [];

  partials.push({
    endpointKey: ek,
    path: endpoint.path,
    method: endpoint.method,
    controller: endpoint.controller,
    category: "baseline",
    fieldPath: "*",
    variant: "valid",
    name: `${endpoint.method} ${endpoint.path} - Baseline`,
    description: "Valid request with overrides applied",
    paramValues: deepClone(baselineParams),
    headers: deepClone(baselineHeaders),
    body: baselineBody ? deepClone(baselineBody) : undefined,
    isBaseline: true,
  });

  partials.push(
    ...generateParamValidationCases(
      endpoint,
      baselineParams,
      endpoint.parameters,
      config.includeNoisyVariants
    )
  );

  partials.push(
    ...generateHeaderValidationCases(
      endpoint,
      baselineParams,
      baselineHeaders,
      endpoint.parameters
    )
  );

  if (baselineBody) {
    partials.push(...generateBodyValidationCases(endpoint, baselineBody));
  }

  const withIds = assignCaseIds(
    partials.map((p) => ({
      ...p,
      paramValues: p.paramValues ?? baselineParams,
      headers: p.headers ?? baselineHeaders,
    })) as ValidationCase[]
  );

  return {
    endpoint,
    cases: capCases(withIds, config.perEndpointCap),
  };
}

export function buildAllValidationSuites(
  endpoints: PlaygroundEndpoint[],
  apiData: {
    paths?: Record<string, unknown>;
    components?: unknown;
  },
  store: ValidationOverridesStore,
  config: ValidationSuiteConfig
): EndpointValidationSuite[] {
  return endpoints.map((ep) =>
    buildEndpointValidationSuite(ep, apiData, store, config)
  );
}

export function estimateValidationCaseCount(
  endpoints: PlaygroundEndpoint[],
  apiData: {
    paths?: Record<string, unknown>;
    components?: unknown;
  },
  store: ValidationOverridesStore,
  config: ValidationSuiteConfig
): { totalCases: number; endpointCount: number; skippedCount: number } {
  const suites = buildAllValidationSuites(endpoints, apiData, store, config);
  let totalCases = 0;
  let skippedCount = 0;
  for (const suite of suites) {
    if (suite.skippedReason) {
      skippedCount++;
    } else {
      totalCases += suite.cases.length;
    }
  }
  return {
    totalCases,
    endpointCount: endpoints.length,
    skippedCount,
  };
}

export function flattenValidationCases(
  suites: EndpointValidationSuite[]
): ValidationCase[] {
  return suites.flatMap((s) => s.cases);
}
