import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  estimateEntityCount,
  isErdPasteFormat,
  sanitizePastedSchema,
  validatePastedSchema,
} from "@/domain/db/erd-paste-schema";

const postgresSample = `CREATE TABLE users (
  id uuid PRIMARY KEY
);
CREATE TABLE posts (
  id uuid PRIMARY KEY
);`;

describe("erd-paste-schema", () => {
  it("recognizes supported formats", () => {
    assert.equal(isErdPasteFormat("postgres"), true);
    assert.equal(isErdPasteFormat("prisma"), true);
    assert.equal(isErdPasteFormat("drizzle"), true);
    assert.equal(isErdPasteFormat("mysql"), false);
  });

  it("estimates entity counts per format", () => {
    assert.equal(estimateEntityCount(postgresSample, "postgres"), 2);
    assert.equal(
      estimateEntityCount("model User {}\nmodel Post {}", "prisma"),
      2
    );
    assert.equal(
      estimateEntityCount('pgTable("a", {});\nsqliteTable("b", {});', "drizzle"),
      2
    );
  });

  it("validates non-empty postgres schema", () => {
    const result = validatePastedSchema({
      content: postgresSample,
      format: "postgres",
    });
    assert.equal(result.tableCount, 2);
    assert.ok(result.content.includes("CREATE TABLE"));
  });

  it("rejects empty schema", () => {
    assert.throws(
      () => validatePastedSchema({ content: "  ", format: "postgres" }),
      /required/
    );
  });

  it("rejects postgres without tables", () => {
    assert.throws(
      () =>
        validatePastedSchema({
          content: "SELECT 1;",
          format: "postgres",
        }),
      /No CREATE TABLE/
    );
  });

  it("rejects dangerous postgres statements", () => {
    assert.throws(
      () =>
        sanitizePastedSchema(
          "CREATE TABLE t (id int); COPY t FROM PROGRAM 'id';",
          "postgres"
        ),
      /disallowed/
    );
  });

  it("allows prisma content without postgres sanitization", () => {
    assert.doesNotThrow(() =>
      sanitizePastedSchema("model User { id String @id }", "prisma")
    );
  });
});
