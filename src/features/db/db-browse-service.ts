import type { DbSchemaSnapshot, DbTableSchema } from "@/domain/db/types";
import { dbFillPageSize } from "@/domain/db/config";
import { executeReadOnlyQuery } from "@/infrastructure/db/postgres-user-client";
import type { UserDbConnectionRow } from "@/infrastructure/db/postgres-user-client";
import { postgresDbConnectionRepository } from "@/infrastructure/repositories/postgres-db-connection-repository";

export type DbBrowseInput = {
  connectionRow: UserDbConnectionRow;
  table: string;
  schema?: string;
  page?: number;
  pageSize?: number;
  sortColumn?: string;
  sortDir?: "asc" | "desc";
  search?: string;
  searchColumn?: string;
};

function parseSnapshot(raw: unknown): DbSchemaSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const tables = (raw as DbSchemaSnapshot).tables;
  if (!Array.isArray(tables)) return null;
  return raw as DbSchemaSnapshot;
}

export function findTableInSnapshot(
  snapshot: DbSchemaSnapshot,
  schema: string,
  table: string
): DbTableSchema | undefined {
  return snapshot.tables.find(
    (t) =>
      t.name.toLowerCase() === table.toLowerCase() &&
      t.schema.toLowerCase() === schema.toLowerCase()
  );
}

export function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export async function browseTable(input: DbBrowseInput) {
  const snapRow = await postgresDbConnectionRepository.getLatestSchema(
    input.connectionRow.id
  );
  const snapshot = parseSnapshot(snapRow?.schemaJson);
  if (!snapshot) {
    throw new Error("No schema snapshot. Run Index schema first.");
  }

  const schema = input.schema?.trim() || "public";
  const tableMeta = findTableInSnapshot(snapshot, schema, input.table.trim());
  if (!tableMeta) {
    throw new Error(`Table not allowed: ${schema}.${input.table}`);
  }

  const columnNames = new Set(
    tableMeta.columns.map((c) => c.name.toLowerCase())
  );
  const page = Math.max(1, Number(input.page ?? 1));
  const pageSize = Math.min(
    50,
    Math.max(1, Number(input.pageSize ?? dbFillPageSize()))
  );
  const offset = (page - 1) * pageSize;

  const sortCol = input.sortColumn?.trim();
  const sortDir = input.sortDir === "desc" ? "DESC" : "ASC";
  const orderClause = sortCol && columnNames.has(sortCol.toLowerCase())
    ? `ORDER BY ${quoteIdent(sortCol)} ${sortDir} NULLS LAST`
    : `ORDER BY 1`;

  const params: unknown[] = [];
  const whereParts: string[] = [];

  const search = input.search?.trim();
  const searchColumn = input.searchColumn?.trim();
  if (search) {
    if (searchColumn && columnNames.has(searchColumn.toLowerCase())) {
      params.push(`%${search}%`);
      whereParts.push(
        `${quoteIdent(searchColumn)}::text ILIKE $${params.length}`
      );
    } else {
      const cols = tableMeta.columns.slice(0, 12);
      const ors = cols.map((c) => {
        params.push(`%${search}%`);
        return `${quoteIdent(c.name)}::text ILIKE $${params.length}`;
      });
      if (ors.length) whereParts.push(`(${ors.join(" OR ")})`);
    }
  }

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
  const fqTable = `${quoteIdent(schema)}.${quoteIdent(tableMeta.name)}`;

  const countSql = `SELECT COUNT(*)::int AS total FROM ${fqTable} ${whereSql}`;
  const dataSql = `SELECT * FROM ${fqTable} ${whereSql} ${orderClause} LIMIT ${pageSize} OFFSET ${offset}`;

  const countResult = await executeReadOnlyQuery(
    input.connectionRow,
    countSql,
    {
      maxRows: 1,
      allowedTables: [tableMeta.name],
      injectLimit: false,
    }
  );
  const total = Number(countResult.rows[0]?.total ?? 0);

  const dataResult = await executeReadOnlyQuery(input.connectionRow, dataSql, {
    maxRows: pageSize,
    allowedTables: [tableMeta.name],
    injectLimit: false,
  });

  return {
    rows: dataResult.rows,
    columns: tableMeta.columns.map((c) => c.name),
    total,
    page,
    pageSize,
    sortColumn: sortCol ?? null,
    sortDir: input.sortDir ?? "asc",
  };
}
