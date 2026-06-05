import type { Client } from "pg";
import type { DbSchemaSnapshot, DbTableSchema } from "@/domain/db/types";

const INTROSPECT_SQL = `
SELECT
  c.table_schema,
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS is_pk
FROM information_schema.columns c
LEFT JOIN (
  SELECT kcu.table_schema, kcu.table_name, kcu.column_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  WHERE tc.constraint_type = 'PRIMARY KEY'
) pk ON pk.table_schema = c.table_schema
      AND pk.table_name = c.table_name
      AND pk.column_name = c.column_name
WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY c.table_schema, c.table_name, c.ordinal_position
`;

const FK_SQL = `
SELECT
  tc.table_schema,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS referenced_table,
  ccu.column_name AS referenced_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
 AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
`;

const ROW_ESTIMATE_SQL = `
SELECT relname AS table_name, reltuples::bigint AS estimate
FROM pg_class
WHERE relkind = 'r' AND relnamespace = (
  SELECT oid FROM pg_namespace WHERE nspname = 'public'
)
`;

export async function introspectPostgresSchema(
  client: Client
): Promise<DbSchemaSnapshot> {
  const [colRes, fkRes, estRes] = await Promise.all([
    client.query(INTROSPECT_SQL),
    client.query(FK_SQL),
    client.query(ROW_ESTIMATE_SQL).catch(() => ({ rows: [] as { table_name: string; estimate: string }[] })),
  ]);

  const estimates = new Map<string, number>();
  for (const r of estRes.rows as { table_name: string; estimate: string }[]) {
    const n = Number(r.estimate);
    if (Number.isFinite(n)) estimates.set(r.table_name, n);
  }

  const tableMap = new Map<string, DbTableSchema>();

  for (const row of colRes.rows as {
    table_schema: string;
    table_name: string;
    column_name: string;
    data_type: string;
    is_nullable: string;
    is_pk: boolean;
  }[]) {
    const key = `${row.table_schema}.${row.table_name}`;
    let table = tableMap.get(key);
    if (!table) {
      table = {
        name: row.table_name,
        schema: row.table_schema,
        columns: [],
        foreignKeys: [],
        approximateRowCount: estimates.get(row.table_name),
      };
      tableMap.set(key, table);
    }
    table.columns.push({
      name: row.column_name,
      dataType: row.data_type,
      nullable: row.is_nullable === "YES",
      isPrimaryKey: row.is_pk,
    });
  }

  for (const row of fkRes.rows as {
    table_schema: string;
    table_name: string;
    column_name: string;
    referenced_table: string;
    referenced_column: string;
  }[]) {
    const key = `${row.table_schema}.${row.table_name}`;
    const table = tableMap.get(key);
    if (!table) continue;
    table.foreignKeys.push({
      column: row.column_name,
      referencedTable: row.referenced_table,
      referencedColumn: row.referenced_column,
    });
  }

  return {
    tables: [...tableMap.values()].sort((a, b) =>
      a.name.localeCompare(b.name)
    ),
    introspectedAt: new Date().toISOString(),
  };
}
