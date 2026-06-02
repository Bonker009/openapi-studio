import { extractPlaygroundEndpoints } from "@/domain/openapi/endpoints";
import { flowEndpointKey } from "@/domain/flows/types";
import { redactObjectDeep } from "@/infrastructure/ai/security/redaction";

export type OpenApiChunkDraft = {
  chunkKey: string;
  chunkType: "endpoint" | "schema" | "auth";
  endpointKey?: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
};

export function chunkOpenApiSpec(
  specId: string,
  openapiJson: Record<string, unknown>
): OpenApiChunkDraft[] {
  const chunks: OpenApiChunkDraft[] = [];
  const endpoints = extractPlaygroundEndpoints({
    paths: openapiJson.paths as
      | Record<string, Record<string, unknown>>
      | undefined,
    security: openapiJson.security as unknown[] | undefined,
  });

  if (openapiJson.security) {
    chunks.push({
      chunkKey: `${specId}:auth:global`,
      chunkType: "auth",
      title: "Global security",
      content: JSON.stringify(redactObjectDeep(openapiJson.security), null, 2),
      metadata: { specId },
    });
  }

  const paths = openapiJson.paths as Record<string, Record<string, unknown>> | undefined;
  for (const ep of endpoints) {
    const key = flowEndpointKey(ep);
    const op = paths?.[ep.path]?.[ep.method.toLowerCase()] as
      | Record<string, unknown>
      | undefined;
    const payload = redactObjectDeep({
      method: ep.method,
      path: ep.path,
      summary: ep.summary,
      description: ep.description,
      parameters: ep.parameters,
      requiresAuth: ep.requiresAuth,
      requestBody: op?.requestBody,
      responses: op?.responses,
      security: op?.security,
    });
    chunks.push({
      chunkKey: `${specId}:endpoint:${key}`,
      chunkType: "endpoint",
      endpointKey: key,
      title: `${ep.method} ${ep.path}`,
      content: JSON.stringify(payload, null, 2),
      metadata: { specId, endpointKey: key, controller: ep.controller },
    });
  }

  const schemas =
    (openapiJson.components as { schemas?: Record<string, unknown> } | undefined)
      ?.schemas ?? {};
  for (const [name, schema] of Object.entries(schemas).slice(0, 200)) {
    chunks.push({
      chunkKey: `${specId}:schema:${name}`,
      chunkType: "schema",
      title: `Schema ${name}`,
      content: JSON.stringify(redactObjectDeep(schema), null, 2),
      metadata: { specId, schemaName: name },
    });
  }

  return chunks;
}
