import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { collectToolResults } from "@/features/ai/unified-assistant-service";

describe("unified-assistant-service", () => {
  it("collects tool results from output field", () => {
    const { blocks, names } = collectToolResults([
      {
        toolResults: [
          { toolName: "search_api_docs", output: "chunk text" },
        ],
      },
    ]);
    assert.deepEqual(names, ["search_api_docs"]);
    assert.equal(blocks[0]?.output, "chunk text");
  });

  it("collects tool results from result field (AI SDK v6)", () => {
    const { blocks } = collectToolResults([
      {
        toolResults: [
          {
            toolName: "execute_readonly_sql",
            result: { rows: [], truncated: true },
          },
        ],
      },
    ]);
    assert.match(blocks[0]?.output ?? "", /truncated/);
    assert.equal(blocks[0]?.truncated, true);
  });

  it("deduplicates tool names across steps", () => {
    const { names } = collectToolResults([
      { toolResults: [{ toolName: "list_api_endpoints", output: "a" }] },
      { toolResults: [{ toolName: "list_api_endpoints", output: "b" }] },
    ]);
    assert.deepEqual(names, ["list_api_endpoints"]);
  });
});
