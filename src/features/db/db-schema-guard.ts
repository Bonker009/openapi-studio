import type { DbSchemaSnapshot, DbTableSchema } from "@/domain/db/types";
import { postgresDbConnectionRepository } from "@/infrastructure/repositories/postgres-db-connection-repository";

function parseSnapshot(raw: unknown): DbSchemaSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const tables = (raw as DbSchemaSnapshot).tables;
  if (!Array.isArray(tables)) return null;
  return raw as DbSchemaSnapshot;
}

export async function loadValidatedTable(
  connectionId: string,
  table: string,
  schema = "public",
  column?: string
): Promise<DbTableSchema> {
  const snapRow = await postgresDbConnectionRepository.getLatestSchema(
    connectionId
  );
  const snapshot = parseSnapshot(snapRow?.schemaJson);
  if (!snapshot) {
    throw new Error("No schema snapshot. Run Index schema first.");
  }
  const meta = snapshot.tables.find(
    (t) =>
      t.name.toLowerCase() === table.toLowerCase() &&
      t.schema.toLowerCase() === schema.toLowerCase()
  );
  if (!meta) {
    throw new Error(`Unknown table: ${schema}.${table}`);
  }
  if (column) {
    const col = meta.columns.find(
      (c) => c.name.toLowerCase() === column.toLowerCase()
    );
    if (!col) {
      throw new Error(`Unknown column: ${column} on ${schema}.${table}`);
    }
  }
  return meta;
}
