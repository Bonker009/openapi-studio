import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { PlaygroundEndpoint } from "@/src/domain/openapi/endpoints";
import {
  applyOverridesToBody,
  applyOverridesToParams,
  resolveOverridesForEndpoint,
  suggestOverrideKeys,
  suggestOverrideKeysForEndpoint,
} from "@/src/domain/validation/overrides";

describe("overrides", () => {
  it("applyOverridesToBody sets matching keys deeply", () => {
    const body = {
      user: { userId: "x", name: "test" },
      tenantId: "old",
    };
    const result = applyOverridesToBody(body, {
      userId: "real-user-1",
      tenantId: "tenant-9",
    });
    assert.equal((result.user as { userId: string }).userId, "real-user-1");
    assert.equal(result.tenantId, "tenant-9");
    assert.equal((result.user as { name: string }).name, "test");
  });

  it("applyOverridesToParams updates param map", () => {
    const params = { userId: "1", page: "1" };
    const result = applyOverridesToParams(params, { userId: "abc" });
    assert.equal(result.userId, "abc");
    assert.equal(result.page, "1");
  });

  it("resolveOverridesForEndpoint merges global and endpoint (endpoint wins)", () => {
    const merged = resolveOverridesForEndpoint(
      {
        global: { userId: "global-id", tenantId: "t1" },
        byEndpoint: {
          "POST:/items": { userId: "endpoint-id" },
        },
      },
      "POST:/items"
    );
    assert.equal(merged.userId, "endpoint-id");
    assert.equal(merged.tenantId, "t1");
  });

  it("suggestOverrideKeysForEndpoint scans one operation only", () => {
    const ep: PlaygroundEndpoint = {
      path: "/items",
      method: "POST",
      controller: "Items",
      parameters: [
        { name: "itemId", in: "path", required: true, schema: { format: "uuid" } },
      ],
      hasRequestBody: true,
      requiresAuth: false,
    };
    const keys = suggestOverrideKeysForEndpoint(
      {
        paths: {
          "/items": {
            post: {
              parameters: ep.parameters,
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: { ownerId: { type: "string" } },
                    },
                  },
                },
              },
            },
          },
          "/other": {
            get: {
              parameters: [{ name: "otherId", in: "query", schema: { type: "string" } }],
            },
          },
        },
      },
      ep
    );
    assert.ok(keys.includes("itemId"));
    assert.ok(keys.includes("ownerId"));
    assert.ok(!keys.includes("otherId"));
  });

  it("suggestOverrideKeys finds id-like fields", () => {
    const keys = suggestOverrideKeys({
      paths: {
        "/users/{userId}": {
          get: {
            parameters: [
              { name: "userId", in: "path", schema: { format: "uuid" } },
            ],
          },
        },
      },
      components: {
        schemas: {
          User: {
            type: "object",
            properties: {
              organizationId: { type: "string" },
              email: { type: "string" },
            },
          },
        },
      },
    });
    assert.ok(keys.includes("userId"));
    assert.ok(keys.includes("organizationId"));
  });
});
