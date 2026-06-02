import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runAutoFixLoop } from "@/domain/ai/pipeline/auto-fix-loop";
import type { FlowSchema } from "@/domain/ai/types";

const catalog = [
  {
    endpointKey: "GET:/pets",
    method: "GET",
    path: "/pets",
    requiresAuth: false,
  },
];

describe("runAutoFixLoop", () => {
  it("returns valid flow without calling fix when already valid", async () => {
    const flow: FlowSchema = {
      nodes: [{ id: "n1", type: "REQUEST", name: "List", endpoint: "GET:/pets" }],
      edges: [],
    };
    let fixCalls = 0;
    const result = await runAutoFixLoop({
      initial: flow,
      catalog,
      fix: async () => {
        fixCalls++;
        return flow;
      },
    });
    assert.equal(result.valid, true);
    assert.equal(fixCalls, 0);
  });

  it("invokes fix when validation fails", async () => {
    const invalid: FlowSchema = {
      nodes: [{ id: "n1", type: "REQUEST", name: "X", endpoint: "DELETE:/x" }],
      edges: [],
    };
    const fixed: FlowSchema = {
      nodes: [{ id: "n1", type: "REQUEST", name: "List", endpoint: "GET:/pets" }],
      edges: [],
    };
    const result = await runAutoFixLoop({
      initial: invalid,
      catalog,
      maxAttempts: 2,
      fix: async () => fixed,
    });
    assert.equal(result.valid, true);
    assert.equal(result.flow.nodes[0].endpoint, "GET:/pets");
  });
});
