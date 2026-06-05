import {
  dbIndexCellMaxChars,
  dbIndexMaxColumnsPerTable,
  dbIndexSampleRows,
} from "@/domain/db/config";
import {
  isSensitiveColumn,
  maskCellValue,
} from "@/domain/db/sensitive-columns";
import type { DbTableSchema } from "@/domain/db/types";
import type { Client } from "pg";

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

export function buildTableChunkText(table: DbTableSchema, sampleLine?: string): string {
  const cols = table.columns
    .slice(0, dbIndexMaxColumnsPerTable())
    .map((c) => {
      const flags = [
        c.isPrimaryKey ? "PK" : null,
        c.nullable ? "null" : "req",
      ]
        .filter(Boolean)
        .join(",");
      return `${c.name} ${c.dataType}${flags ? ` ${flags}` : ""}`;
    })
    .join(", ");

  const fks = table.foreignKeys
    .map((fk) => `${fk.column} -> ${fk.referencedTable}.${fk.referencedColumn}`)
    .join("; ");

  const parts = [
    `Table ${table.schema}.${table.name}`,
    `columns: ${cols || "(none)"}`,
  ];
  if (fks) parts.push(`FK: ${fks}`);
  if (table.approximateRowCount != null) {
    parts.push(`~${table.approximateRowCount} rows`);
  }
  if (sampleLine) parts.push(`sample: ${sampleLine}`);
  return parts.join(" | ");
}

export async function fetchMicroSample(
  client: Client,
  table: DbTableSchema
): Promise<string | undefined> {
  const sampleRows = dbIndexSampleRows();
  if (sampleRows <= 0) return undefined;

  const cols = table.columns
    .filter((c) => !/bytea|json|text$/i.test(c.dataType) && !isSensitiveColumn(c.name))
    .slice(0, 8)
    .map((c) => `"${c.name}"`);

  if (cols.length === 0) return undefined;

  const q = `SELECT ${cols.join(", ")} FROM "${table.schema}"."${table.name}" LIMIT ${sampleRows}`;
  try {
    const res = await client.query(q);
    const maxChars = dbIndexCellMaxChars();
    const lines = (res.rows as Record<string, unknown>[]).map((row, i) => {
      const pairs = cols.map((c) => {
        const name = c.replace(/"/g, "");
        return `${name}=${truncate(maskCellValue(name, row[name]), maxChars)}`;
      });
      return `row${i + 1}: ${pairs.join(", ")}`;
    });
    return lines.join("; ");
  } catch {
    return undefined;
  }
}
