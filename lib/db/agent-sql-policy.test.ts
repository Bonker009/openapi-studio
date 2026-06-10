import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  aiDbQueryHardMaxRows,
  aiDbQueryInjectLimit,
  unifiedAgentMaxSteps,
} from "@/domain/db/config";
import { sanitizeReadOnlySql } from "@/domain/db/sanitize-sql";

const keys = [
  "AI_DB_QUERY_INJECT_LIMIT",
  "AI_DB_QUERY_HARD_MAX_ROWS",
  "UNIFIED_AGENT_MAX_STEPS",
] as const;

const envSnapshot: Partial<Record<(typeof keys)[number], string | undefined>> =
  {};

describe("agent-sql-policy", () => {
  beforeEach(() => {
    for (const key of keys) {
      envSnapshot[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of keys) {
      if (envSnapshot[key] === undefined) delete process.env[key];
      else process.env[key] = envSnapshot[key];
    }
  });

  it("defaults injectLimit to false for agent path", () => {
    assert.equal(aiDbQueryInjectLimit(), false);
  });

  it("honors AI_DB_QUERY_INJECT_LIMIT=true", () => {
    process.env.AI_DB_QUERY_INJECT_LIMIT = "true";
    assert.equal(aiDbQueryInjectLimit(), true);
  });

  it("skips auto LIMIT when injectLimit is false", () => {
    const sql = sanitizeReadOnlySql("SELECT id FROM users", {
      injectLimit: false,
    });
    assert.doesNotMatch(sql, /LIMIT/i);
  });

  it("still injects LIMIT on default playground path", () => {
    const sql = sanitizeReadOnlySql("SELECT id FROM users");
    assert.match(sql, /LIMIT\s+20/i);
  });

  it("hard max rows defaults to disabled", () => {
    assert.equal(aiDbQueryHardMaxRows(), 0);
  });

  it("parses hard max rows cap", () => {
    process.env.AI_DB_QUERY_HARD_MAX_ROWS = "5000";
    assert.equal(aiDbQueryHardMaxRows(), 5000);
  });

  it("unified agent max steps defaults to 8", () => {
    assert.equal(unifiedAgentMaxSteps(), 8);
  });

  it("clamps unified agent max steps", () => {
    process.env.UNIFIED_AGENT_MAX_STEPS = "99";
    assert.equal(unifiedAgentMaxSteps(), 16);
  });
});
