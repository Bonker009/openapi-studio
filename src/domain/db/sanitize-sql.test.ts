import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizeReadOnlySql } from "@/domain/db/sanitize-sql";

describe("sanitizeReadOnlySql", () => {
  it("allows SELECT with LIMIT injection", () => {
    const sql = sanitizeReadOnlySql("SELECT id FROM users");
    assert.match(sql, /LIMIT\s+20/i);
  });

  it("blocks DELETE", () => {
    assert.throws(() => sanitizeReadOnlySql("DELETE FROM users"));
  });

  it("blocks multi-statement", () => {
    assert.throws(() =>
      sanitizeReadOnlySql("SELECT 1; SELECT 2")
    );
  });

  it("blocks INSERT in comment bypass attempt via AST", () => {
    assert.throws(() =>
      sanitizeReadOnlySql("SELECT * FROM users WHERE 1=0; DROP TABLE users")
    );
  });
});
