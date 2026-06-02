import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parsePlanFromText } from "@/domain/ai/pipeline/plan-parser";

describe("parsePlanFromText", () => {
  it("parses numbered steps with endpoints", () => {
    const plan = parsePlanFromText(
      "1. List pets (GET /pets)\n2. Create pet (POST /pets)",
      "smoke test"
    );
    assert.equal(plan.intent, "smoke test");
    assert.equal(plan.steps.length, 2);
    assert.equal(plan.steps[0].endpoint, "GET /pets");
    assert.equal(plan.steps[1].endpoint, "POST /pets");
  });
});
