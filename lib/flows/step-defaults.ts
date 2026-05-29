import { defaultParamValues } from "@/lib/playground/build-request";
import {
  generateOpenApiSample,
  getOperationSamples,
} from "@/lib/playground/generate-sample";
import type { OpenApiParameter, PlaygroundEndpoint } from "@/lib/playground/endpoints";
import { getRequestBodySchema } from "@/lib/openapi-schema";
import {
  formatMultipartBodyHint,
  getRequestBodyInfo,
} from "@/lib/playground/request-body";
import { flowEndpointKey, newStepId, type FlowStep } from "@/lib/flows/types";

export type FlowApiData = {
  paths?: Record<string, unknown>;
  components?: unknown;
};

export function getEndpointMethodData(
  endpoint: PlaygroundEndpoint,
  apiData: FlowApiData
): Record<string, unknown> | null {
  if (!apiData.paths) return null;
  const methods = apiData.paths[endpoint.path] as
    | Record<string, unknown>
    | undefined;
  if (!methods) return null;
  return (methods[endpoint.method.toLowerCase()] as Record<string, unknown>) ?? null;
}

/** Sample JSON / hint text for an endpoint request body. */
export function defaultFlowStepBody(
  endpoint: PlaygroundEndpoint,
  apiData: FlowApiData,
  baseUrl: string
): string | undefined {
  if (!endpoint.hasRequestBody) return undefined;

  const methodData = getEndpointMethodData(endpoint, apiData);
  if (!methodData) return "{}";

  const bodyInfo = getRequestBodyInfo(methodData, apiData.components);
  if (bodyInfo.kind === "multipart") {
    return formatMultipartBodyHint(bodyInfo.multipartFields);
  }
  if (bodyInfo.kind === "binary") {
    return "file: (binary octet-stream)";
  }

  const samples = getOperationSamples(
    baseUrl,
    endpoint.path,
    methodData,
    endpoint.parameters,
    apiData.components
  );
  if (samples?.requestBody) return samples.requestBody;

  const schema = getRequestBodySchema(
    methodData as {
      requestBody?: { content?: Record<string, { schema?: unknown }> };
    }
  );
  if (schema) {
    return JSON.stringify(
      generateOpenApiSample(schema, apiData.components) ?? {},
      null,
      2
    );
  }
  return "{}";
}

function splitParameters(parameters: OpenApiParameter[]) {
  return {
    path: parameters.filter((p) => p.in === "path"),
    query: parameters.filter((p) => p.in === "query"),
    header: parameters.filter((p) => p.in === "header"),
    cookie: parameters.filter((p) => p.in === "cookie"),
  };
}

export function createFlowStepFromEndpoint(
  endpoint: PlaygroundEndpoint,
  apiData: FlowApiData,
  baseUrl: string
): FlowStep {
  const { path, query, header, cookie } = splitParameters(endpoint.parameters);
  const paramValues = {
    ...defaultParamValues(path),
    ...defaultParamValues(query),
    ...defaultParamValues(cookie),
  };
  const headerValues = defaultParamValues(header);
  const body = defaultFlowStepBody(endpoint, apiData, baseUrl);

  return {
    id: newStepId(),
    endpointKey: flowEndpointKey(endpoint),
    paramValues,
    headerValues,
    body,
    extractions: [],
  };
}

/** Merge saved values with OpenAPI defaults so new params appear on old flows. */
export function mergeStepFields(
  step: FlowStep,
  endpoint: PlaygroundEndpoint
): { paramValues: Record<string, string>; headerValues: Record<string, string> } {
  const { path, query, header, cookie } = splitParameters(endpoint.parameters);
  const paramDefaults = {
    ...defaultParamValues(path),
    ...defaultParamValues(query),
    ...defaultParamValues(cookie),
  };
  const headerDefaults = defaultParamValues(header);
  return {
    paramValues: { ...paramDefaults, ...step.paramValues },
    headerValues: { ...headerDefaults, ...step.headerValues },
  };
}

export function methodSupportsOptionalBody(method: string): boolean {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}
