import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chunkOpenApiSpec } from "@/infrastructure/ai/rag/openapi-chunker";

const sampleSpec = {
  openapi: "3.0.0",
  info: { title: "Petstore", version: "1.0.0" },
  paths: {
    "/pets": {
      get: { summary: "List pets", responses: { "200": { description: "OK" } } },
      post: {
        summary: "Create pet",
        requestBody: {
          content: {
            "application/json": {
              schema: { type: "object", properties: { name: { type: "string" } } },
            },
          },
        },
        responses: { "201": { description: "Created" } },
      },
    },
  },
  components: {
    schemas: {
      Pet: { type: "object", properties: { id: { type: "integer" } } },
    },
  },
};

describe("chunkOpenApiSpec", () => {
  it("creates endpoint and schema chunks", () => {
    const chunks = chunkOpenApiSpec("spec-1", sampleSpec);
    assert.ok(chunks.length >= 3);
    assert.ok(chunks.some((c) => c.chunkType === "endpoint" && c.endpointKey === "GET:/pets"));
    assert.ok(chunks.some((c) => c.chunkType === "schema" && c.title.includes("Pet")));
  });

  it("redacts nothing from non-secret fields", () => {
    const chunks = chunkOpenApiSpec("spec-1", sampleSpec);
    const getChunk = chunks.find((c) => c.endpointKey === "GET:/pets");
    assert.ok(getChunk?.content.includes("List pets"));
  });
});
