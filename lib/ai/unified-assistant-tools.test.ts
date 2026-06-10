import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { toolNameToStatusPhase } from "@/infrastructure/ai/unified-assistant-tools";
import { sanitizeReadOnlySql } from "@/domain/db/sanitize-sql";

describe("unified-assistant-tools", () => {
  it("maps API tools to searching-api phase", () => {
    assert.equal(toolNameToStatusPhase("search_api_docs"), "searching-api");
    assert.equal(toolNameToStatusPhase("list_api_endpoints"), "searching-api");
  });

  it("maps DB schema tools to searching-db phase", () => {
    assert.equal(toolNameToStatusPhase("search_db_schema"), "searching-db");
    assert.equal(toolNameToStatusPhase("list_db_tables"), "searching-db");
    assert.equal(toolNameToStatusPhase("get_table_schema"), "searching-db");
  });

  it("maps SQL tool to running-sql phase", () => {
    assert.equal(toolNameToStatusPhase("execute_readonly_sql"), "running-sql");
  });

  it("rejects disallowed tables in SQL guard", () => {
    assert.throws(() =>
      sanitizeReadOnlySql("SELECT * FROM secret_table", {
        allowedTables: ["users"],
        injectLimit: false,
      })
    );
  });

  it("allows SELECT on allowlisted table without LIMIT injection", () => {
    const sql = sanitizeReadOnlySql("SELECT id FROM users", {
      allowedTables: ["users"],
      injectLimit: false,
    });
    assert.match(sql, /FROM users/i);
    assert.doesNotMatch(sql, /LIMIT/i);
  });
});
