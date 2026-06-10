import type { DbSchemaSnapshot, DbTableSchema } from "@/domain/db/types";

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function fqTable(table: DbTableSchema): string {
  return `${quoteIdent(table.schema)}.${quoteIdent(table.name)}`;
}

function constraintName(prefix: string, table: DbTableSchema, suffix: string): string {
  const raw = `${prefix}_${table.schema}_${table.name}_${suffix}`.replace(/[^a-zA-Z0-9_]/g, "_");
  return raw.slice(0, 60);
}

export function snapshotToPgsqlDdl(snapshot: DbSchemaSnapshot): string {
  const lines: string[] = [
    "-- Generated from DbSchemaSnapshot for Liam ERD",
    `SET search_path TO public;`,
    "",
  ];

  for (const table of snapshot.tables) {
    const colDefs = table.columns.map((col) => {
      const nullable = col.nullable ? "" : " NOT NULL";
      return `  ${quoteIdent(col.name)} ${col.dataType}${nullable}`;
    });

    const pkCols = table.columns.filter((c) => c.isPrimaryKey).map((c) => quoteIdent(c.name));
    if (pkCols.length) {
      colDefs.push(`  PRIMARY KEY (${pkCols.join(", ")})`);
    }

    lines.push(`CREATE TABLE ${fqTable(table)} (`);
    lines.push(colDefs.join(",\n"));
    lines.push(");");
    lines.push("");
  }

  for (const table of snapshot.tables) {
    for (let i = 0; i < table.foreignKeys.length; i++) {
      const fk = table.foreignKeys[i]!;
      const refSchema = table.schema;
      const cname = constraintName("fk", table, `${fk.column}_${i}`);
      lines.push(
        `ALTER TABLE ${fqTable(table)} ADD CONSTRAINT ${quoteIdent(cname)} FOREIGN KEY (${quoteIdent(fk.column)}) REFERENCES ${quoteIdent(refSchema)}.${quoteIdent(fk.referencedTable)} (${quoteIdent(fk.referencedColumn)});`
      );
    }
    if (table.foreignKeys.length) lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}
