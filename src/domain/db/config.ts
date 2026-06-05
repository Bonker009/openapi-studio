export const DB_TERMS_VERSION = "v1";

export function dbAgentEnabled(): boolean {
  return process.env.DB_AGENT_ENABLED !== "false";
}

export function getDbCredentialsEncryptionKey(): string {
  const key = process.env.DB_CREDENTIALS_ENCRYPTION_KEY?.trim();
  if (!key) {
    throw new Error("DB_CREDENTIALS_ENCRYPTION_KEY is required to store database connections");
  }
  return key;
}

export function dbIndexSampleRows(): number {
  const n = Number(process.env.DB_INDEX_SAMPLE_ROWS ?? 2);
  return Number.isFinite(n) ? Math.min(5, Math.max(0, n)) : 2;
}

export function dbIndexMaxColumnsPerTable(): number {
  const n = Number(process.env.DB_INDEX_MAX_COLUMNS_PER_TABLE ?? 32);
  return Number.isFinite(n) ? Math.min(64, Math.max(4, n)) : 32;
}

export function dbIndexCellMaxChars(): number {
  const n = Number(process.env.DB_INDEX_CELL_MAX_CHARS ?? 64);
  return Number.isFinite(n) ? Math.min(256, Math.max(8, n)) : 64;
}

export function dbQueryMaxRows(): number {
  const n = Number(process.env.DB_QUERY_MAX_ROWS ?? 20);
  return Number.isFinite(n) ? Math.min(50, Math.max(1, n)) : 20;
}

export function dbQueryMaxResponseBytes(): number {
  const n = Number(process.env.DB_QUERY_MAX_RESPONSE_BYTES ?? 32768);
  return Number.isFinite(n) ? Math.min(131072, Math.max(1024, n)) : 32768;
}

export function dbQueryTimeoutMs(): number {
  const n = Number(process.env.DB_QUERY_TIMEOUT_MS ?? 5000);
  return Number.isFinite(n) ? Math.min(30000, Math.max(1000, n)) : 5000;
}

export function dbAgentMaxSqlRetries(): number {
  const n = Number(process.env.DB_AGENT_MAX_SQL_RETRIES ?? 3);
  return Number.isFinite(n) ? Math.min(5, Math.max(0, n)) : 3;
}

export function dbConnectAllowedHosts(): string[] | null {
  const raw = process.env.DB_CONNECT_ALLOWED_HOSTS?.trim();
  if (!raw) return null;
  return raw
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

export function dbFillPageSize(): number {
  const n = Number(process.env.DB_FILL_PAGE_SIZE ?? 10);
  return Number.isFinite(n) ? Math.min(50, Math.max(1, n)) : 10;
}
