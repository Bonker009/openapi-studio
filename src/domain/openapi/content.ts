/**
 * Centralized OpenAPI media-type selection for request/response bodies.
 */

export type OpenApiMediaType = {
  schema?: unknown;
  example?: unknown;
  examples?: Record<string, { value?: unknown }>;
};

/** Prefer JSON-family content types, then fall back to first entry. */
export function pickJsonContent(
  content?: Record<string, OpenApiMediaType>
): OpenApiMediaType | undefined {
  if (!content) return undefined;
  return (
    content["application/json"] ??
    content["application/*+json"] ??
    content["*/*"] ??
    content["application/*"] ??
    Object.values(content)[0]
  );
}

/** Pick request body content with multipart/form-data priority when present. */
export function pickRequestBodyContent(
  content?: Record<string, OpenApiMediaType>
): OpenApiMediaType | undefined {
  if (!content) return undefined;
  if (content["multipart/form-data"]) {
    return content["multipart/form-data"];
  }
  return pickJsonContent(content);
}
