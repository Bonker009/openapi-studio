import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { snapshotToPgsqlDdl } from "@/domain/db/snapshot-to-pgsql";
import type { DbSchemaSnapshot } from "@/domain/db/types";

const snapshot: DbSchemaSnapshot = {
  introspectedAt: "2026-01-01T00:00:00.000Z",
  tables: [
    {
      schema: "public",
      name: "users",
      columns: [
        { name: "id", dataType: "integer", nullable: false, isPrimaryKey: true },
        { name: "email", dataType: "text", nullable: true },
      ],
      foreignKeys: [],
    },
    {
      schema: "public",
      name: "orders",
      columns: [
        { name: "id", dataType: "integer", nullable: false, isPrimaryKey: true },
        { name: "user_id", dataType: "integer", nullable: false },
      ],
      foreignKeys: [
        {
          column: "user_id",
          referencedTable: "users",
          referencedColumn: "id",
        },
      ],
    },
  ],
};

describe("snapshotToPgsqlDdl", () => {
  it("emits CREATE TABLE with quoted schema and columns", () => {
    const sql = snapshotToPgsqlDdl(snapshot);
    assert.match(sql, /CREATE TABLE "public"\."users"/);
    assert.match(sql, /"id" integer NOT NULL/);
    assert.match(sql, /"email" text/);
    assert.match(sql, /PRIMARY KEY \("id"\)/);
  });

  it("emits FOREIGN KEY constraints", () => {
    const sql = snapshotToPgsqlDdl(snapshot);
    assert.match(sql, /FOREIGN KEY \("user_id"\)/);
    assert.match(sql, /REFERENCES "public"\."users" \("id"\)/);
  });

  it("quotes identifiers with embedded quotes", () => {
    const sql = snapshotToPgsqlDdl({
      introspectedAt: "t",
      tables: [
        {
          schema: "app",
          name: 'weird"name',
          columns: [{ name: "id", dataType: "integer", nullable: false }],
          foreignKeys: [],
        },
      ],
    });
    assert.match(sql, /"weird""name"/);
  });
});
