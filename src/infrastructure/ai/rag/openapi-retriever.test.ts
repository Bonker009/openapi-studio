import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { recallAndRerankChunks } from "@/infrastructure/ai/rag/openapi-retriever";

function mockRow(input: {
  id: string;
  title: string;
  content: string;
  endpointKey?: string;
  controller?: string;
  embedding?: number[];
}) {
  return {
    id: input.id,
    specId: "spec-1",
    chunkKey: input.id,
    chunkType: "endpoint",
    endpointKey: input.endpointKey ?? null,
    title: input.title,
    content: input.content,
    metadata: input.controller ? { controller: input.controller } : {},
    embeddingJson: input.embedding ?? [1, 0],
    updatedAt: new Date(),
  };
}

describe("recallAndRerankChunks", () => {
  it("ranks path-specific chunk above unrelated chunk", () => {
    const rows = [
      mockRow({
        id: "a",
        title: "GET /orders",
        content: "orders",
        endpointKey: "GET:/orders",
        controller: "Orders",
        embedding: [0, 1],
      }),
      mockRow({
        id: "b",
        title: "GET /pets",
        content: "pets list",
        endpointKey: "GET:/pets",
        controller: "Pets",
        embedding: [1, 0],
      }),
    ];
    const queryEmbedding = [1, 0];
    const result = recallAndRerankChunks({
      query: "GET /pets details",
      rows,
      queryEmbedding,
      finalLimit: 2,
    });
    assert.equal(result.length, 2);
    assert.equal(result[0]?.endpointKey, "GET:/pets");
    assert.ok(result[0]!.score >= (result[1]?.score ?? 0));
  });

  it("returns empty when no rows pass recall threshold", () => {
    const rows = [
      mockRow({
        id: "x",
        title: "Schema Foo",
        content: "unrelated",
        embedding: [0, 0],
      }),
    ];
    const result = recallAndRerankChunks({
      query: "zzz",
      rows,
      queryEmbedding: [0, 0],
      finalLimit: 5,
    });
    assert.equal(result.length, 0);
  });
});
