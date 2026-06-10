import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  erdCacheKeyFromContent,
  erdCacheKeyFromSnapshot,
  erdCachePath,
  erdPasteCachePath,
} from "@/features/db/liam-erd-service";
import type { DbSchemaSnapshot } from "@/domain/db/types";

const snapshot: DbSchemaSnapshot = {
  introspectedAt: "2026-06-01T12:00:00.000Z",
  tables: [],
};

describe("liam-erd-service helpers", () => {
  it("derives stable cache key from introspectedAt", () => {
    const a = erdCacheKeyFromSnapshot(snapshot);
    const b = erdCacheKeyFromSnapshot(snapshot);
    assert.equal(a, b);
    assert.equal(a.length, 16);
  });

  it("changes cache key when snapshot timestamp changes", () => {
    const other = erdCacheKeyFromSnapshot({
      ...snapshot,
      introspectedAt: "2026-06-02T12:00:00.000Z",
    });
    assert.notEqual(erdCacheKeyFromSnapshot(snapshot), other);
  });

  it("builds cache path under connection id", () => {
    const connId = "550e8400-e29b-41d4-a716-446655440000";
    const p = erdCachePath(connId, "a1b2c3d4e5f67890");
    assert.match(p, /550e8400-e29b-41d4-a716-446655440000[\\/]a1b2c3d4e5f67890$/);
  });

  it("derives stable cache key from pasted content and format", () => {
    const ddl = "CREATE TABLE users (id uuid PRIMARY KEY);";
    const a = erdCacheKeyFromContent(ddl, "postgres");
    const b = erdCacheKeyFromContent(ddl, "postgres");
    assert.equal(a, b);
    assert.equal(a.length, 16);
    assert.notEqual(erdCacheKeyFromContent(ddl, "prisma"), a);
  });

  it("builds paste cache path under spec id", () => {
    const p = erdPasteCachePath("default", "a1b2c3d4e5f67890");
    assert.match(p, /paste[\\/]default[\\/]a1b2c3d4e5f67890$/);
  });
});
