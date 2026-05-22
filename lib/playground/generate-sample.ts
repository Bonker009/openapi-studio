import type { OpenApiParameter } from "@/lib/playground/endpoints";
import { buildRequestUrl } from "@/lib/playground/build-request";
import {
  getRequestBodySchema,
  getResponseBodySchema,
} from "@/lib/openapi-schema";

type OpenApiComponents = { schemas?: Record<string, unknown> };

type OpenApiMediaType = {
  schema?: unknown;
  example?: unknown;
  examples?: Record<string, { value?: unknown }>;
};

function pickJsonContent(
  content?: Record<string, OpenApiMediaType>
): OpenApiMediaType | undefined {
  if (!content) return undefined;
  const entry =
    content["application/json"] ??
    content["application/*+json"] ??
    content["*/*"] ??
    content["application/*"] ??
    Object.values(content)[0];
  return entry;
}

function exampleFromContent(
  content?: Record<string, OpenApiMediaType>
): unknown | undefined {
  const entry = pickJsonContent(content);
  if (!entry) return undefined;
  if (entry.example !== undefined) return entry.example;
  const examples = entry.examples;
  if (examples && typeof examples === "object") {
    const first = Object.values(examples)[0];
    if (first && typeof first === "object" && "value" in first) {
      return (first as { value?: unknown }).value;
    }
  }
  return undefined;
}

/** Generate example JSON from an OpenAPI schema (Swagger-style). */
export function generateOpenApiSample(
  schema: unknown,
  components: unknown,
  depth = 0
): unknown {
  if (!schema || depth > 12) return null;

  const s = schema as Record<string, unknown>;
  const comps = components as OpenApiComponents | undefined;

  if (typeof s.$ref === "string") {
    const name = s.$ref.replace("#/components/schemas/", "");
    if (comps?.schemas?.[name]) {
      return generateOpenApiSample(comps.schemas[name], components, depth + 1);
    }
    return null;
  }

  if (s.type === "object" || s.properties) {
    const result: Record<string, unknown> = {};
    const props = (s.properties as Record<string, unknown>) ?? {};
    const required = (s.required as string[]) ?? [];
    for (const propName of Object.keys(props)) {
      if (required.includes(propName)) {
        result[propName] = generateOpenApiSample(props[propName], components, depth + 1);
      }
    }
    return result;
  }

  if (s.type === "array" && s.items) {
    return [generateOpenApiSample(s.items, components, depth + 1)];
  }

  if (s.type === "string") {
    if (s.format === "date-time") return "2023-01-01T12:00:00Z";
    if (s.format === "date") return "2023-01-01";
    if (s.format === "uuid") return "123e4567-e89b-12d3-a456-426614174000";
    if (s.format === "email") return "user@example.com";
    if (s.format === "uri") return "https://example.com";
    if (Array.isArray(s.enum) && s.enum.length > 0) return s.enum[0];
    return "string";
  }

  if (s.type === "integer" || s.type === "number") {
    const min = s.minimum as number | undefined;
    const max = s.maximum as number | undefined;
    if (min !== undefined && max !== undefined) {
      return Math.floor((min + max) / 2);
    }
    if (min !== undefined) return min;
    if (max !== undefined) return max;
    return s.type === "integer" ? 0 : 0;
  }

  if (s.type === "boolean") return true;

  const composite = (s.oneOf ?? s.anyOf ?? s.allOf) as unknown[] | undefined;
  if (Array.isArray(composite) && composite.length > 0) {
    return generateOpenApiSample(composite[0], components, depth + 1);
  }

  return null;
}

export function formatSampleJson(value: unknown): string {
  if (value == null) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** Placeholder values for sample URL display (includes optional query params). */
export function buildSampleParamValues(
  parameters: OpenApiParameter[]
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const p of parameters) {
    if (p.in !== "path" && p.in !== "query") continue;
    if (p.schema?.enum?.[0] != null) {
      values[p.name] = String(p.schema.enum[0]);
    } else if (p.schema?.type === "boolean") {
      values[p.name] = "true";
    } else if (p.schema?.type === "integer" || p.schema?.type === "number") {
      values[p.name] = "1";
    } else if (p.schema?.format === "uuid") {
      values[p.name] = "123e4567-e89b-12d3-a456-426614174000";
    } else if (p.in === "path") {
      values[p.name] = p.name;
    } else {
      values[p.name] = "value";
    }
  }
  return values;
}

export function buildSampleRequestUrl(
  baseUrl: string,
  path: string,
  parameters: OpenApiParameter[]
): string {
  return buildRequestUrl(
    baseUrl,
    path,
    buildSampleParamValues(parameters),
    parameters
  );
}

export type ResponseSampleEntry = {
  code: string;
  description?: string;
  body: string;
};

export type OperationSamples = {
  requestUrl: string;
  requestBody: string | null;
  responses: ResponseSampleEntry[];
};

export function getOperationSamples(
  baseUrl: string,
  path: string,
  methodData: Record<string, unknown> | null,
  parameters: OpenApiParameter[],
  components: unknown
): OperationSamples | null {
  if (!methodData) return null;

  const requestUrl = buildSampleRequestUrl(baseUrl, path, parameters);

  let requestBody: string | null = null;
  const requestBodySchema = getRequestBodySchema(
    methodData as { requestBody?: { content?: Record<string, { schema?: unknown; example?: unknown }> } }
  );
  const requestContent = (
    methodData as { requestBody?: { content?: Record<string, { schema?: unknown; example?: unknown; examples?: Record<string, { value?: unknown }> }> } }
  ).requestBody?.content;

  if (requestBodySchema || requestContent) {
    const example = exampleFromContent(requestContent);
    const sample =
      example ??
      (requestBodySchema
        ? generateOpenApiSample(requestBodySchema, components)
        : null);
    const formatted = formatSampleJson(sample);
    requestBody = formatted || null;
  }

  const responsesRaw = (
    methodData as {
      responses?: Record<
        string,
        {
          description?: string;
          content?: Record<string, { schema?: unknown; example?: unknown; examples?: Record<string, { value?: unknown }> }>;
        }
      >;
    }
  ).responses;

  const responses: ResponseSampleEntry[] = [];
  if (responsesRaw) {
    const codes = Object.keys(responsesRaw).sort((a, b) => {
      const a2 = a.startsWith("2");
      const b2 = b.startsWith("2");
      if (a2 && !b2) return -1;
      if (!a2 && b2) return 1;
      return a.localeCompare(b, undefined, { numeric: true });
    });

    for (const code of codes) {
      const resp = responsesRaw[code];
      const example = exampleFromContent(resp?.content);
      const schema = resp?.content
        ? pickJsonContent(resp.content)?.schema
        : undefined;
      const sample =
        example ??
        (schema ? generateOpenApiSample(schema, components) : null);
      const body = formatSampleJson(sample);
      if (!body) continue;
      responses.push({
        code,
        description: resp?.description,
        body,
      });
    }
  }

  if (responses.length === 0) {
    const fallbackSchema = getResponseBodySchema(
      methodData as {
        responses?: Record<string, { content?: Record<string, { schema?: unknown }> }>;
      }
    );
    if (fallbackSchema) {
      const sample = generateOpenApiSample(fallbackSchema, components);
      const body = formatSampleJson(sample);
      if (body) {
        responses.push({ code: "200", description: "Success", body });
      }
    }
  }

  return { requestUrl, requestBody, responses };
}
