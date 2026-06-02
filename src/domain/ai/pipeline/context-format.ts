import type { RetrievedChunk } from "@/domain/ai/types";

function formatChunkHeader(c: RetrievedChunk, rank: number): string {
  const parts = [
    `#${rank}`,
    `[${c.chunkType}]`,
    c.title,
    c.endpointKey ? `endpoint=${c.endpointKey}` : null,
    c.controller ? `controller=${c.controller}` : null,
    `relevance=${c.score.toFixed(3)}`,
  ].filter(Boolean);
  return parts.join(" ");
}

export function chunksToContextBlocks(chunks: RetrievedChunk[]): string[] {
  return chunks.map((c, i) => {
    const header = formatChunkHeader(c, i + 1);
    const body =
      c.content.length > 2400
        ? `${c.content.slice(0, 2400)}\n…(truncated)`
        : c.content;
    return `${header}\n${body}`;
  });
}

export function resolveBaseUrl(
  openapiJson: Record<string, unknown>,
  override?: string
): string {
  if (override?.trim()) return override.trim().replace(/\/$/, "");
  const servers = openapiJson.servers as { url?: string }[] | undefined;
  const url = servers?.[0]?.url?.trim();
  return (url || "http://localhost").replace(/\/$/, "");
}
