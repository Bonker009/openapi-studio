import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  cosineSimilarity,
  controllerTagOverlap,
  endpointTokenOverlap,
  exactPathMethodBoost,
  extractHttpMethodsFromQuery,
  extractPathFragmentsFromQuery,
  computeRecallScore,
  computeRerankScore,
  lexicalScore,
} from "@/infrastructure/ai/rag/embedding-math";

describe("embedding-math", () => {
  it("computes cosine similarity", () => {
    assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
    assert.ok(cosineSimilarity([1, 0], [0, 1]) < 0.01);
  });

  it("scores lexical overlap", () => {
    const score = lexicalScore("GET pets list", "GET /pets list all pets");
    assert.ok(score > 0.5);
  });

  it("extracts HTTP methods and path fragments from query", () => {
    const methods = extractHttpMethodsFromQuery("How does POST /users work?");
    assert.ok(methods.has("POST"));
    const paths = extractPathFragmentsFromQuery("compare GET /pets and /orders");
    assert.ok(paths.includes("/pets"));
    assert.ok(paths.includes("/orders"));
  });

  it("boosts exact method/path matches", () => {
    const boost = exactPathMethodBoost("GET /pets details", {
      title: "GET /pets",
      content: "{}",
      endpointKey: "GET:/pets",
    });
    assert.ok(boost > 0.5);
  });

  it("scores controller/tag overlap", () => {
    const score = controllerTagOverlap("pets controller endpoints", {
      title: "GET /pets",
      content: "{}",
      controller: "Pets",
    });
    assert.ok(score > 0);
  });

  it("combines recall and rerank scores", () => {
    const recall = computeRecallScore({
      semantic: 0.8,
      lexical: 0.4,
      weights: { semantic: 0.6, lexical: 0.4 },
    });
    assert.ok(recall > 0.5);
    const rerank = computeRerankScore({
      recallScore: recall,
      query: "GET /pets",
      chunk: {
        title: "GET /pets",
        content: "list pets",
        endpointKey: "GET:/pets",
        controller: "Pets",
      },
      weights: { recall: 0.55, openapiFeatures: 0.3, exactBoost: 0.15 },
    });
    assert.ok(rerank > 0.4);
    assert.ok(rerank >= recall * 0.5);
  });

  it("endpoint token overlap favors matching resource names", () => {
    const high = endpointTokenOverlap("pets inventory", {
      title: "GET /pets",
      content: "pets list",
    });
    const low = endpointTokenOverlap("pets inventory", {
      title: "GET /orders",
      content: "orders list",
    });
    assert.ok(high > low);
  });
});
