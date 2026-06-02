import { createHash } from "node:crypto";

export function buildFlowCacheKey(specId: string, normalizedIntent: string): string {
  return createHash("sha256")
    .update(`${specId}:${normalizedIntent.trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, 48);
}
