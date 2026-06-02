import { extractPlaygroundEndpoints } from "@/domain/openapi/endpoints";
import { flowEndpointKey } from "@/domain/flows/types";

export type EndpointCatalogEntry = {
  endpointKey: string;
  method: string;
  path: string;
  requiresAuth: boolean;
  summary?: string;
};

export function buildEndpointCatalog(
  openapiJson: Record<string, unknown>
): EndpointCatalogEntry[] {
  return extractPlaygroundEndpoints({
    paths: openapiJson.paths as
      | Record<string, Record<string, unknown>>
      | undefined,
    security: openapiJson.security as unknown[] | undefined,
  }).map((ep) => ({
    endpointKey: flowEndpointKey(ep),
    method: ep.method,
    path: ep.path,
    requiresAuth: ep.requiresAuth,
    summary: ep.summary,
  }));
}

export function normalizeEndpointRef(ref: string): string {
  const trimmed = ref.trim();
  const match = trimmed.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(.+)$/i);
  if (!match) return trimmed;
  return `${match[1].toUpperCase()}:${match[2].trim()}`;
}
