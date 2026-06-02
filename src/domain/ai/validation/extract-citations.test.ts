import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractCitedEndpointsFromAnswer } from "@/domain/ai/validation/extract-citations";

describe("extractCitedEndpointsFromAnswer", () => {
  it("finds endpoints mentioned in answer text", () => {
    const cited = extractCitedEndpointsFromAnswer(
      "Use GET /pets to list and POST /pets to create.",
      ["GET:/pets", "POST:/pets", "DELETE:/pets"]
    );
    assert.deepEqual(cited.sort(), ["GET:/pets", "POST:/pets"].sort());
  });
});
