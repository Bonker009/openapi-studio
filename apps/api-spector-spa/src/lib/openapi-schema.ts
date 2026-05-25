type OpenApiComponents = {
  schemas?: Record<string, unknown>;
};

const MAX_DEPTH = 16;

/** Resolve `#/components/schemas/...` and nested refs for display. */
export function resolveOpenApiSchema(
  schema: unknown,
  components?: OpenApiComponents,
  seen: Set<string> = new Set(),
  depth = 0
): unknown {
  if (schema == null || depth > MAX_DEPTH) {
    return schema;
  }

  if (typeof schema !== "object" || Array.isArray(schema)) {
    return schema;
  }

  const obj = schema as Record<string, unknown>;

  if (typeof obj.$ref === "string") {
    const ref = obj.$ref;
    if (seen.has(ref)) {
      return { $ref: ref, description: "(circular reference)" };
    }
    const name = ref.replace(/^#\/components\/schemas\//, "");
    const target = components?.schemas?.[name];
    if (!target) {
      return { $ref: ref, description: "(schema not found in spec)" };
    }
    seen.add(ref);
    const resolved = resolveOpenApiSchema(target, components, seen, depth + 1);
    seen.delete(ref);
    return resolved;
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === "properties" && value && typeof value === "object") {
      const props: Record<string, unknown> = {};
      for (const [propName, propSchema] of Object.entries(
        value as Record<string, unknown>
      )) {
        props[propName] = resolveOpenApiSchema(
          propSchema,
          components,
          seen,
          depth + 1
        );
      }
      out[key] = props;
    } else if (
      (key === "items" ||
        key === "additionalProperties" ||
        key === "not") &&
      value &&
      typeof value === "object"
    ) {
      out[key] = resolveOpenApiSchema(value, components, seen, depth + 1);
    } else if (
      (key === "allOf" || key === "oneOf" || key === "anyOf") &&
      Array.isArray(value)
    ) {
      out[key] = value.map((item) =>
        resolveOpenApiSchema(item, components, seen, depth + 1)
      );
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Short type label for tables (resolves ref name or primitive type). */
export function schemaTypeLabel(schema: unknown): string {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return "-";
  }
  const s = schema as Record<string, unknown>;
  if (typeof s.$ref === "string") {
    return s.$ref.split("/").pop() ?? "ref";
  }
  if (s.type === "array" && s.items) {
    return `array<${schemaTypeLabel(s.items)}>`;
  }
  if (typeof s.type === "string") {
    return s.format ? `${s.type} (${s.format})` : s.type;
  }
  return "object";
}

export function schemaRefLabel(schema: unknown): string | null {
  if (
    schema &&
    typeof schema === "object" &&
    !Array.isArray(schema) &&
    typeof (schema as Record<string, unknown>).$ref === "string"
  ) {
    const ref = (schema as Record<string, unknown>).$ref as string;
    return ref.split("/").pop() ?? null;
  }
  return null;
}

/** Pick request body schema from common content types. */
export function getRequestBodySchema(methodData: {
  requestBody?: { content?: Record<string, { schema?: unknown }> };
}): unknown {
  const content = methodData.requestBody?.content;
  if (!content) return undefined;
  return (
    content["application/json"]?.schema ??
    content["application/*+json"]?.schema ??
    Object.values(content)[0]?.schema
  );
}

/** Pick first 2xx response schema from common content types. */
export function getResponseBodySchema(methodData: {
  responses?: Record<
    string,
    { content?: Record<string, { schema?: unknown }> }
  >;
}): unknown {
  const responses = methodData.responses ?? {};
  const code =
    responses["200"] != null
      ? "200"
      : Object.keys(responses).find((c) => c.startsWith("2"));
  if (!code) return undefined;

  const content = responses[code]?.content;
  if (!content) return undefined;

  return (
    content["application/json"]?.schema ??
    content["*/*"]?.schema ??
    content["application/*"]?.schema ??
    Object.values(content)[0]?.schema
  );
}
