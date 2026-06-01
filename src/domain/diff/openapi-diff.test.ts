import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  compareJsonSchemas,
  diffOpenApi,
  normalizeDiffSummary,
} from "./openapi-diff";

const baseDoc = {
  openapi: "3.0.0",
  info: { title: "T", version: "1.0.0" },
  paths: {},
};

describe("diffOpenApi severity", () => {
  it("classifies removed endpoint as breaking", () => {
    const old = {
      ...baseDoc,
      paths: {
        "/users": {
          get: { operationId: "listUsers", responses: { "200": { description: "ok" } } },
        },
      },
    };
    const neu = { ...baseDoc, paths: {} };
    const summary = diffOpenApi(old, neu);
    assert.equal(summary.removed.length, 1);
    assert.equal(summary.removed[0].severity, "breaking");
    assert.equal(summary.worstSeverity, "breaking");
  });

  it("classifies added endpoint as additive", () => {
    const old = { ...baseDoc, paths: {} };
    const neu = {
      ...baseDoc,
      paths: {
        "/users": {
          get: { operationId: "listUsers", responses: { "200": { description: "ok" } } },
        },
      },
    };
    const summary = diffOpenApi(old, neu);
    assert.equal(summary.added.length, 1);
    assert.equal(summary.added[0].severity, "additive");
    assert.equal(summary.worstSeverity, "additive");
  });

  it("classifies removed response code as breaking", () => {
    const old = {
      ...baseDoc,
      paths: {
        "/x": {
          get: {
            responses: {
              "200": { description: "ok" },
              "404": { description: "nf" },
            },
          },
        },
      },
    };
    const neu = {
      ...baseDoc,
      paths: {
        "/x": {
          get: { responses: { "200": { description: "ok" } } },
        },
      },
    };
    const summary = diffOpenApi(old, neu);
    assert.equal(summary.changed.length, 1);
    assert.equal(summary.changed[0].severity, "breaking");
  });

  it("classifies summary-only change as non-breaking", () => {
    const old = {
      ...baseDoc,
      paths: {
        "/x": {
          get: { summary: "Old", responses: { "200": { description: "ok" } } },
        },
      },
    };
    const neu = {
      ...baseDoc,
      paths: {
        "/x": {
          get: { summary: "New", responses: { "200": { description: "ok" } } },
        },
      },
    };
    const summary = diffOpenApi(old, neu);
    assert.equal(summary.changed[0].severity, "non-breaking");
  });

  it("suggests major bump when breaking changes exist", () => {
    const old = {
      ...baseDoc,
      paths: {
        "/gone": { delete: { responses: { "204": { description: "ok" } } } },
      },
    };
    const neu = { ...baseDoc, paths: {} };
    const summary = diffOpenApi(old, neu);
    assert.equal(summary.suggestedBump, "major");
  });
});

describe("compareJsonSchemas", () => {
  it("detects enum subset as breaking", () => {
    const sev = compareJsonSchemas(
      { type: "string", enum: ["a", "b", "c"] },
      { type: "string", enum: ["a", "b"] }
    );
    assert.equal(sev, "breaking");
  });

  it("detects enum superset as additive", () => {
    const sev = compareJsonSchemas(
      { type: "string", enum: ["a", "b"] },
      { type: "string", enum: ["a", "b", "c"] }
    );
    assert.equal(sev, "additive");
  });

  it("detects added required property as breaking", () => {
    const sev = compareJsonSchemas(
      { type: "object", properties: { a: { type: "string" } }, required: [] },
      {
        type: "object",
        properties: { a: { type: "string" }, b: { type: "string" } },
        required: ["b"],
      }
    );
    assert.equal(sev, "breaking");
  });
});

describe("normalizeDiffSummary", () => {
  it("backfills severity on legacy summaries", () => {
    const legacy = {
      added: [{ path: "/n", method: "GET" }],
      removed: [],
      changed: [],
      moved: [],
      infoChanged: false,
      suggestedBump: "minor",
    };
    const normalized = normalizeDiffSummary(legacy);
    assert.equal(normalized.added[0].severity, "additive");
    assert.ok(normalized.severityCounts.additive >= 1);
  });
});
