import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  erdMaxTables,
  isAllowedErdAssetExtension,
  isValidConnectionId,
  isValidErdCacheKey,
} from "@/domain/db/erd-security";
import { erdCachePath } from "@/features/db/liam-erd-service";

describe("erd-security", () => {
  it("accepts UUID connection ids", () => {
    assert.ok(
      isValidConnectionId("550e8400-e29b-41d4-a716-446655440000")
    );
  });

  it("rejects path traversal in connection id", () => {
    assert.ok(!isValidConnectionId("../../../etc/passwd"));
    assert.ok(!isValidConnectionId("not-a-uuid"));
  });

  it("validates cache key format", () => {
    assert.ok(isValidErdCacheKey("a1b2c3d4e5f67890"));
    assert.ok(!isValidErdCacheKey("../escape"));
  });

  it("erdCachePath rejects invalid ids", () => {
    assert.throws(() => erdCachePath("bad-id", "a1b2c3d4e5f67890"));
  });

  it("allowlists Liam asset extensions", () => {
    assert.ok(isAllowedErdAssetExtension(".js"));
    assert.ok(isAllowedErdAssetExtension(".wasm"));
    assert.ok(!isAllowedErdAssetExtension(".exe"));
  });

  it("caps max tables with sane default", () => {
    assert.ok(erdMaxTables() >= 1);
  });
});
