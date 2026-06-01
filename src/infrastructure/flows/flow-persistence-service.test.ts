import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  FLOW_RUN_SUMMARY_MAX,
  redactSummaryHeaders,
} from "./flow-persistence-service";

describe("redactSummaryHeaders", () => {
  it("redacts sensitive headers and caps long values", () => {
    const veryLong = "x".repeat(FLOW_RUN_SUMMARY_MAX + 50);
    const headers = redactSummaryHeaders({
      Authorization: "Bearer secret",
      Cookie: "a=b",
      "X-Custom": veryLong,
    });

    assert.equal(headers?.Authorization, "[REDACTED]");
    assert.equal(headers?.Cookie, "[REDACTED]");
    assert.equal(
      typeof headers?.["X-Custom"] === "string",
      true
    );
    assert.match(String(headers?.["X-Custom"]), /…$/);
  });
});
