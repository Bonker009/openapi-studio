import { Client, type ClientConfig } from "pg";
import { parse as parseConnectionString } from "pg-connection-string";
import { pgDbConnections } from "@/infrastructure/database/pg-flow-schema";
import { decryptSecret } from "@/infrastructure/db/credential-crypto";
import {
  aiDbQueryHardMaxRows,
  aiDbQueryInjectLimit,
  dbConnectAllowedHosts,
  dbQueryMaxResponseBytes,
  dbQueryMaxRows,
  dbQueryTimeoutMs,
} from "@/domain/db/config";
import { sanitizeReadOnlySql } from "@/domain/db/sanitize-sql";

export type UserDbConnectionRow = typeof pgDbConnections.$inferSelect;

export function assertAllowedHost(host: string): void {
  const allow = dbConnectAllowedHosts();
  if (!allow) return;
  const h = host.trim().toLowerCase();
  if (!allow.includes(h) && !allow.includes("*")) {
    throw new Error(`Host not allowed: ${host}`);
  }
}

export function buildUserClientConfig(
  row: UserDbConnectionRow,
  password: string
): ClientConfig {
  assertAllowedHost(row.host);
  const ssl =
    row.sslMode === "disable"
      ? false
      : row.sslMode === "require"
        ? { rejectUnauthorized: false }
        : undefined;

  return {
    host: row.host,
    port: row.port,
    database: row.database,
    user: row.username,
    password,
    ssl,
    connectionTimeoutMillis: dbQueryTimeoutMs(),
    statement_timeout: dbQueryTimeoutMs(),
    query_timeout: dbQueryTimeoutMs(),
  };
}

export function getPasswordForConnection(row: UserDbConnectionRow): string {
  return decryptSecret(row.encryptedSecret);
}

export async function withUserDbClient<T>(
  row: UserDbConnectionRow,
  fn: (client: Client) => Promise<T>
): Promise<T> {
  const password = getPasswordForConnection(row);
  const client = new Client(buildUserClientConfig(row, password));
  await client.connect();
  try {
    await client.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY");
    return await fn(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function testUserDbConnection(
  row: UserDbConnectionRow
): Promise<void> {
  await withUserDbClient(row, async (client) => {
    await client.query("SELECT 1");
  });
}

export type ReadOnlyQueryResult = {
  rows: Record<string, unknown>[];
  rowCount: number;
  sql: string;
  truncated?: boolean;
  totalFetched?: number;
  note?: string;
};

function trimRowsToByteCap(
  rows: Record<string, unknown>[],
  maxBytes: number
): { rows: Record<string, unknown>[]; truncated: boolean; totalFetched: number } {
  let json = JSON.stringify(rows);
  if (Buffer.byteLength(json, "utf8") <= maxBytes) {
    return { rows, truncated: false, totalFetched: rows.length };
  }
  const trimmed: Record<string, unknown>[] = [];
  for (const r of rows) {
    trimmed.push(r);
    json = JSON.stringify(trimmed);
    if (Buffer.byteLength(json, "utf8") > maxBytes) {
      trimmed.pop();
      break;
    }
  }
  return { rows: trimmed, truncated: true, totalFetched: rows.length };
}

export async function executeReadOnlyQuery(
  row: UserDbConnectionRow,
  rawSql: string,
  options?: { maxRows?: number; allowedTables?: string[]; injectLimit?: boolean }
): Promise<ReadOnlyQueryResult> {
  const sql = sanitizeReadOnlySql(rawSql, {
    maxRows: options?.maxRows ?? dbQueryMaxRows(),
    allowedTables: options?.allowedTables,
    injectLimit: options?.injectLimit,
  });

  return withUserDbClient(row, async (client) => {
    const result = await client.query(sql);
    const rows = (result.rows ?? []) as Record<string, unknown>[];
    const maxBytes = dbQueryMaxResponseBytes();
    const capped = trimRowsToByteCap(rows, maxBytes);
    return {
      rows: capped.rows,
      rowCount: capped.rows.length,
      sql,
      truncated: capped.truncated,
      totalFetched: capped.totalFetched,
      note: capped.truncated
        ? "Response trimmed to fit byte limit; not all rows included."
        : undefined,
    };
  });
}

/** Agent chat SQL: no auto LIMIT unless query includes one; optional hard max rows. */
export async function executeAgentReadOnlyQuery(
  row: UserDbConnectionRow,
  rawSql: string,
  options?: { allowedTables?: string[] }
): Promise<ReadOnlyQueryResult> {
  const hardMax = aiDbQueryHardMaxRows();
  const injectLimit = aiDbQueryInjectLimit();
  const sql = sanitizeReadOnlySql(rawSql, {
    maxRows: hardMax > 0 ? hardMax : dbQueryMaxRows(),
    allowedTables: options?.allowedTables,
    injectLimit,
  });

  return withUserDbClient(row, async (client) => {
    const result = await client.query(sql);
    let rows = (result.rows ?? []) as Record<string, unknown>[];
    if (hardMax > 0 && rows.length > hardMax) {
      rows = rows.slice(0, hardMax);
    }
    const maxBytes = dbQueryMaxResponseBytes();
    const capped = trimRowsToByteCap(rows, maxBytes);
    return {
      rows: capped.rows,
      rowCount: capped.rows.length,
      sql,
      truncated: capped.truncated || (hardMax > 0 && capped.totalFetched > hardMax),
      totalFetched: capped.totalFetched,
      note: capped.truncated
        ? "Response trimmed to fit byte limit; not all rows included."
        : hardMax > 0 && capped.totalFetched > hardMax
          ? `Hard row cap ${hardMax} applied.`
          : undefined,
    };
  });
}

export function parseConnectionUri(uri: string): {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
} {
  const parsed = parseConnectionString(uri);
  if (!parsed.host || !parsed.database || !parsed.user) {
    throw new Error("Invalid PostgreSQL connection URI");
  }
  return {
    host: parsed.host,
    port: parsed.port ? Number(parsed.port) : 5432,
    database: parsed.database,
    username: parsed.user,
    password: parsed.password ?? "",
  };
}
