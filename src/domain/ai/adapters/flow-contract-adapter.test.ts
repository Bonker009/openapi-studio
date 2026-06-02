import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { flowSchemaToInternalFlow } from "@/domain/ai/adapters/flow-contract-adapter";
import type { FlowSchema } from "@/domain/ai/types";

describe("flowSchemaToInternalFlow", () => {
  it("maps nodes to ordered legacy steps", () => {
    const flowSchema: FlowSchema = {
      nodes: [
        { id: "a", type: "REQUEST", name: "List", endpoint: "GET:/pets" },
        { id: "b", type: "REQUEST", name: "Create", endpoint: "POST:/pets" },
      ],
      edges: [{ from: "a", to: "b", type: "success" }],
    };
    const flow = flowSchemaToInternalFlow({
      specId: "spec-1",
      name: "Test",
      baseUrl: "https://api.example.com",
      flowSchema,
    });
    assert.equal(flow.steps.length, 2);
    assert.equal(flow.steps[0].endpointKey, "GET:/pets");
    assert.equal(flow.steps[1].endpointKey, "POST:/pets");
    assert.deepEqual(flow.connections, [{ source: "a", target: "b" }]);
  });
});
