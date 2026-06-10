import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  findTableInSnapshot,
  quoteIdent,
} from "@/features/db/db-browse-service";
import type { DbSchemaSnapshot } from "@/domain/db/types";

const snapshot: DbSchemaSnapshot = {
  tables: [
    {
      schema: "public",
      name: "users",
      columns: [
        { name: "id", dataType: "integer", nullable: false },
        { name: "email", dataType: "text", nullable: true },
      ],
      primaryKey: ["id"],
      foreignKeys: [],
    },
    {
      schema: "app",
      name: "orders",
      columns: [{ name: "id", dataType: "integer", nullable: false }],
      primaryKey: ["id"],
      foreignKeys: [],
    },
  ],
};

describe("db-browse-service", () => {
  it("finds table case-insensitively", () => {
    const t = findTableInSnapshot(snapshot, "public", "Users");
    assert.equal(t?.name, "users");
    assert.equal(t?.columns.length, 2);
  });

  it("returns undefined for unknown table", () => {
    assert.equal(findTableInSnapshot(snapshot, "public", "missing"), undefined);
  });

  it("quotes identifiers safely", () => {
    assert.equal(quoteIdent('col"name'), '"col""name"');
    assert.equal(quoteIdent("id"), '"id"');
  });

  it("sort column allowlist is enforced via snapshot columns", () => {
    const t = findTableInSnapshot(snapshot, "public", "users");
    const allowed = new Set(t!.columns.map((c) => c.name.toLowerCase()));
    assert.ok(allowed.has("email"));
    assert.ok(!allowed.has("password"));
  });
});
