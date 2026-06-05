import { Client, type ClientConfig } from "pg";
import { parse as parseConnectionString } from "pg-connection-string";
import { pgDbConnections } from "@/infrastructure/database/pg-flow-schema";
import { decryptSecret } from "@/infrastructure/db/credential-crypto";
import { dbConnectAllowedHosts, dbQueryTimeoutMs } from "@/domain/db/config";
import {
  dbQueryMaxResponseBytes,
  dbQueryMaxRows,
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

export async function executeReadOnlyQuery(
  row: UserDbConnectionRow,
  rawSql: string,
  options?: { maxRows?: number; allowedTables?: string[] }
): Promise<{ rows: Record<string, unknown>[]; rowCount: number; sql: string }> {
  const sql = sanitizeReadOnlySql(rawSql, {
    maxRows: options?.maxRows ?? dbQueryMaxRows(),
    allowedTables: options?.allowedTables,
  });

  return withUserDbClient(row, async (client) => {
    const result = await client.query(sql);
    const rows = (result.rows ?? []) as Record<string, unknown>[];
    let json = JSON.stringify(rows);
    const maxBytes = dbQueryMaxResponseBytes();
    if (Buffer.byteLength(json, "utf8") > maxBytes) {
      const trimmed: Record<string, unknown>[] = [];
      for (const r of rows) {
        trimmed.push(r);
        json = JSON.stringify(trimmed);
        if (Buffer.byteLength(json, "utf8") > maxBytes) {
          trimmed.pop();
          break;
        }
      }
      return { rows: trimmed, rowCount: trimmed.length, sql };
    }
    return { rows, rowCount: rows.length, sql };
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
