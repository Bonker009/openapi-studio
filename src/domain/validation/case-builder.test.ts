import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildEndpointValidationSuite,
  estimateValidationCaseCount,
} from "@/src/domain/validation/case-builder";
import { DEFAULT_VALIDATION_CONFIG } from "@/src/domain/validation/types";
import type { PlaygroundEndpoint } from "@/src/domain/openapi/endpoints";

const endpoint: PlaygroundEndpoint = {
  path: "/items",
  method: "POST",
  controller: "Items",
  parameters: [
    {
      name: "X-Tenant",
      in: "header",
      required: true,
      schema: { type: "string" },
    },
  ],
  hasRequestBody: true,
  requiresAuth: false,
};

const apiData = {
  paths: {
    "/items": {
      post: {
        parameters: endpoint.parameters,
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  count: { type: "integer" },
                },
                required: ["name"],
              },
            },
          },
        },
        responses: { "400": { description: "Bad request" } },
      },
    },
  },
};

describe("case-builder", () => {
  it("builds baseline and field cases for JSON body endpoint", () => {
    const suite = buildEndpointValidationSuite(
      endpoint,
      apiData,
      {
        global: {},
        byEndpoint: {
          "POST:/items": { name: "Widget" },
        },
      },
      DEFAULT_VALIDATION_CONFIG
    );
    assert.ok(!suite.skippedReason);
    assert.ok(suite.cases.length > 1);
    const baseline = suite.cases.find((c) => c.isBaseline);
    assert.ok(baseline);
    assert.equal((baseline?.body as { name: string })?.name, "Widget");
    const bodyCases = suite.cases.filter((c) => c.category === "body");
    assert.ok(bodyCases.length > 0);
    const headerCases = suite.cases.filter((c) => c.category === "header");
    assert.ok(headerCases.length > 0);
  });

  it("estimateValidationCaseCount returns positive total", () => {
    const est = estimateValidationCaseCount(
      [endpoint],
      apiData,
      { global: {}, byEndpoint: {} },
      DEFAULT_VALIDATION_CONFIG
    );
    assert.ok(est.totalCases > 0);
    assert.equal(est.endpointCount, 1);
  });
});
