import type { ExportColumn, ExportSheet } from "@/lib/export-excel";
import type { PlaygroundEndpoint } from "@/lib/playground/endpoints";
import {
  getRequestBodySchema,
  getResponseBodySchema,
  schemaTypeLabel,
} from "@/lib/openapi-schema";

const ENDPOINT_COLUMNS: ExportColumn[] = [
  { id: "method", label: "Method" },
  { id: "path", label: "Path" },
  { id: "tag", label: "Tag" },
  { id: "summary", label: "Summary" },
  { id: "operationId", label: "Operation ID" },
  { id: "authRequired", label: "Auth Required" },
  { id: "requestBody", label: "Request Body" },
  { id: "response2xx", label: "Response (2xx)" },
];

const SCHEMA_COLUMNS: ExportColumn[] = [
  { id: "schema", label: "Schema" },
  { id: "property", label: "Property" },
  { id: "type", label: "Type" },
  { id: "format", label: "Format" },
  { id: "required", label: "Required" },
  { id: "description", label: "Description" },
];

function requestBodyLabel(
  path: string,
  method: string,
  apiData: { paths?: Record<string, unknown>; components?: unknown }
): string {
  const schema = getRequestBodySchema(path, method, apiData);
  return schema ? schemaTypeLabel(schema) : "";
}

function response2xxLabel(
  path: string,
  method: string,
  apiData: { paths?: Record<string, unknown>; components?: unknown }
): string {
  const schema = getResponseBodySchema(path, method, "200", apiData);
  if (schema) return schemaTypeLabel(schema);
  const schema201 = getResponseBodySchema(path, method, "201", apiData);
  return schema201 ? schemaTypeLabel(schema201) : "";
}

export function buildEndpointRows(
  endpoints: PlaygroundEndpoint[],
  apiData: { paths?: Record<string, unknown>; components?: unknown }
): Record<string, unknown>[] {
  return endpoints.map((ep) => ({
    method: ep.method,
    path: ep.path,
    tag: ep.controller,
    summary: ep.summary ?? "",
    operationId: ep.operationId ?? "",
    authRequired: ep.requiresAuth ? "Yes" : "No",
    requestBody: ep.hasRequestBody
      ? requestBodyLabel(ep.path, ep.method, apiData)
      : "",
    response2xx: response2xxLabel(ep.path, ep.method, apiData),
  }));
}

function flattenSchema(
  name: string,
  schema: Record<string, unknown>,
  requiredSet: Set<string>,
  prefix: string
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  const props = schema.properties as Record<string, Record<string, unknown>> | undefined;
  if (!props) {
    rows.push({
      schema: name,
      property: prefix || "(root)",
      type: schemaTypeLabel(schema),
      format: String(schema.format ?? ""),
      required: "",
      description: String(schema.description ?? ""),
    });
    return rows;
  }

  for (const [prop, propSchema] of Object.entries(props)) {
    const path = prefix ? `${prefix}.${prop}` : prop;
    const nested =
      propSchema.type === "object" && propSchema.properties
        ? flattenSchema(name, propSchema, new Set(), path)
        : null;
    if (nested) {
      rows.push(...nested);
    } else {
      rows.push({
        schema: name,
        property: path,
        type: schemaTypeLabel(propSchema),
        format: String(propSchema.format ?? ""),
        required: requiredSet.has(prop) ? "Yes" : "No",
        description: String(propSchema.description ?? ""),
      });
    }
  }
  return rows;
}

export function buildSchemaRows(
  apiData: { components?: unknown }
): Record<string, unknown>[] {
  const components = apiData.components as
    | { schemas?: Record<string, Record<string, unknown>> }
    | undefined;
  const schemas = components?.schemas ?? {};
  const rows: Record<string, unknown>[] = [];

  for (const [name, schema] of Object.entries(schemas)) {
    const required = Array.isArray(schema.required)
      ? new Set(schema.required.map(String))
      : new Set<string>();
    rows.push(...flattenSchema(name, schema, required, ""));
  }

  return rows.sort(
    (a, b) =>
      String(a.schema).localeCompare(String(b.schema)) ||
      String(a.property).localeCompare(String(b.property))
  );
}

export function buildEndpointWorkbookSheets(
  endpoints: PlaygroundEndpoint[],
  apiData: { paths?: Record<string, unknown>; components?: unknown }
): ExportSheet[] {
  const schemaRows = buildSchemaRows(apiData);
  const sheets: ExportSheet[] = [
    {
      name: "Endpoints",
      rows: buildEndpointRows(endpoints, apiData),
      columns: ENDPOINT_COLUMNS,
    },
  ];
  if (schemaRows.length > 0) {
    sheets.push({
      name: "Schemas",
      rows: schemaRows,
      columns: SCHEMA_COLUMNS,
    });
  }
  return sheets;
}
