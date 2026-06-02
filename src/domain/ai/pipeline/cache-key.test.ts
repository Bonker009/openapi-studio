import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildFlowCacheKey } from "@/domain/ai/pipeline/cache-key";

describe("buildFlowCacheKey", () => {
  it("is stable for same intent", () => {
    const a = buildFlowCacheKey("spec-1", "List all pets");
    const b = buildFlowCacheKey("spec-1", "list all pets");
    assert.equal(a, b);
  });

  it("differs across specs", () => {
    const a = buildFlowCacheKey("spec-1", "intent");
    const b = buildFlowCacheKey("spec-2", "intent");
    assert.notEqual(a, b);
  });
});
