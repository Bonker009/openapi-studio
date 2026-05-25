import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateOpenApiSample,
  getOperationSamples,
  isTrivialEmptyObject,
  sampleFromSchema,
} from "./generate-sample";

const components = {
  schemas: {
    ApiResponseBase: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        message: { type: "string" },
        status: { type: "string" },
        timestamp: { type: "string", format: "date-time" },
      },
    },
    WorkspacePayload: {
      type: "object",
      properties: {
        payload: {
          type: "array",
          items: {
            type: "object",
            properties: {
              workspaceId: { type: "string", format: "uuid" },
              name: { type: "string" },
            },
          },
        },
      },
    },
  },
};

describe("generateOpenApiSample", () => {
  it("includes optional object properties (not only required)", () => {
    const sample = generateOpenApiSample(
      {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string" },
          payload: { type: "array", items: { type: "object" } },
        },
        required: [],
      },
      components
    ) as Record<string, unknown>;

    assert.equal(isTrivialEmptyObject(sample), false);
    assert.equal(sample.success, true);
    assert.equal(sample.message, "string");
    assert.ok(Array.isArray(sample.payload));
  });

  it("merges allOf sub-schemas into one object", () => {
    const sample = generateOpenApiSample(
      {
        allOf: [
          { $ref: "#/components/schemas/ApiResponseBase" },
          { $ref: "#/components/schemas/WorkspacePayload" },
        ],
      },
      components
    ) as Record<string, unknown>;

    assert.equal(sample.success, true);
    assert.equal(sample.message, "string");
    assert.ok(Array.isArray(sample.payload));
    assert.equal((sample.payload as unknown[]).length, 1);
  });

  it("uses schema default when set", () => {
    const sample = generateOpenApiSample(
      {
        type: "object",
        properties: {
          count: { type: "integer", default: 42 },
        },
      },
      components
    ) as Record<string, unknown>;

    assert.equal(sample.count, 42);
  });
});

describe("getOperationSamples", () => {
  it("produces non-empty 200 response for allOf wrapper schema", () => {
    const methodData = {
      responses: {
        "200": {
          description: "OK",
          content: {
            "application/json": {
              schema: {
                allOf: [
                  { $ref: "#/components/schemas/ApiResponseBase" },
                  { $ref: "#/components/schemas/WorkspacePayload" },
                ],
              },
            },
          },
        },
      },
    };

    const samples = getOperationSamples(
      "http://localhost:9090",
      "/api/v3/workspaces",
      methodData,
      [],
      components
    );

    assert.ok(samples);
    assert.equal(samples!.responses.length, 1);
    assert.equal(samples!.responses[0].code, "200");
    assert.equal(samples!.responses[0].description, "OK");
    assert.notEqual(samples!.responses[0].body.trim(), "{}");

    const parsed = JSON.parse(samples!.responses[0].body) as Record<
      string,
      unknown
    >;
    assert.equal(parsed.success, true);
    assert.ok("payload" in parsed);
  });

  it("keeps explicit example from spec unchanged", () => {
    const methodData = {
      responses: {
        "200": {
          description: "OK",
          content: {
            "application/json": {
              example: { success: false, message: "from-spec" },
            },
          },
        },
      },
    };

    const samples = getOperationSamples(
      "http://localhost:9090",
      "/test",
      methodData,
      [],
      components
    );

    const parsed = JSON.parse(samples!.responses[0].body) as Record<
      string,
      unknown
    >;
    assert.equal(parsed.success, false);
    assert.equal(parsed.message, "from-spec");
  });
});

describe("sampleFromSchema", () => {
  it("resolves $ref to allOf wrapper", () => {
    const schema = { $ref: "#/components/schemas/ApiResponseBase" };
    const sample = sampleFromSchema(schema, components) as Record<
      string,
      unknown
    >;
    assert.equal(sample.success, true);
    assert.equal(sample.message, "string");
  });
});
