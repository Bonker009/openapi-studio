import { normalizeEndpointRef } from "@/domain/ai/validation/endpoint-catalog";

/** Infer cited endpoints from prose that mentions METHOD /path or METHOD:path. */
export function extractCitedEndpointsFromAnswer(
  answer: string,
  allowedEndpoints: string[]
): string[] {
  const found = new Set<string>();
  const lower = answer.toLowerCase();

  for (const ep of allowedEndpoints) {
    const key = normalizeEndpointRef(ep);
    const colonIdx = key.indexOf(":");
    if (colonIdx < 0) continue;
    const method = key.slice(0, colonIdx);
    const path = key.slice(colonIdx + 1);
    const variants = [
      key.toLowerCase(),
      `${method} ${path}`.toLowerCase(),
      `${method}:${path}`.toLowerCase(),
    ];
    if (variants.some((v) => lower.includes(v))) {
      found.add(key);
    }
  }
  return [...found];
}
