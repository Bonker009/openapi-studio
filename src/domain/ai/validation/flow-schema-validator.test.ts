import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateFlowSchema } from "@/domain/ai/validation/flow-schema-validator";
import type { FlowSchema } from "@/domain/ai/types";

const catalog = [
  {
    endpointKey: "GET:/pets",
    method: "GET",
    path: "/pets",
    requiresAuth: false,
  },
  {
    endpointKey: "POST:/pets",
    method: "POST",
    path: "/pets",
    requiresAuth: false,
  },
];

const validFlow: FlowSchema = {
  nodes: [
    { id: "n1", type: "REQUEST", name: "List", endpoint: "GET:/pets" },
    { id: "n2", type: "REQUEST", name: "Create", endpoint: "POST:/pets" },
  ],
  edges: [
    { from: "n1", to: "n2", type: "success" },
  ],
};

describe("validateFlowSchema", () => {
  it("accepts a connected valid flow", () => {
    const result = validateFlowSchema(validFlow, catalog);
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  it("rejects unknown endpoints", () => {
    const flow: FlowSchema = {
      nodes: [
        { id: "n1", type: "REQUEST", name: "X", endpoint: "DELETE:/missing" },
      ],
      edges: [],
    };
    const result = validateFlowSchema(flow, catalog);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.code === "unknown_endpoint"));
  });

  it("rejects invalid edge endpoints", () => {
    const flow: FlowSchema = {
      nodes: [
        { id: "n1", type: "REQUEST", name: "List", endpoint: "GET:/pets" },
        { id: "n2", type: "REQUEST", name: "Create", endpoint: "POST:/pets" },
      ],
      edges: [{ from: "n1", to: "missing", type: "success" }],
    };
    const result = validateFlowSchema(flow, catalog);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.code === "invalid_edge"));
  });
});
