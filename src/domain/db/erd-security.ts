/** PostgreSQL connection rows use UUID primary keys. */
const CONNECTION_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CACHE_KEY_RE = /^[a-f0-9]{16}$/;

/** Allowed static asset extensions from Liam ERD build output. */
const ERD_ASSET_EXTENSIONS = new Set([
  ".html",
  ".js",
  ".mjs",
  ".css",
  ".json",
  ".wasm",
  ".svg",
  ".png",
  ".ico",
  ".woff",
  ".woff2",
  ".map",
]);

export function isValidConnectionId(id: string): boolean {
  return CONNECTION_ID_RE.test(id.trim());
}

export function isValidErdCacheKey(key: string): boolean {
  return CACHE_KEY_RE.test(key);
}

export function isAllowedErdAssetExtension(ext: string): boolean {
  return ERD_ASSET_EXTENSIONS.has(ext.toLowerCase());
}

/** Cap schema size to limit CLI build time and disk use. */
export function erdMaxTables(): number {
  const n = Number(process.env.LIAM_ERD_MAX_TABLES ?? 500);
  return Number.isFinite(n) ? Math.min(2000, Math.max(1, Math.floor(n))) : 500;
}

export function erdBuildTimeoutMs(): number {
  const n = Number(process.env.LIAM_ERD_BUILD_TIMEOUT_MS ?? 120_000);
  return Number.isFinite(n) ? Math.min(300_000, Math.max(10_000, Math.floor(n))) : 120_000;
}

/** Max pasted schema payload size for Liam ERD builds. */
export function erdMaxDdlBytes(): number {
  const n = Number(process.env.LIAM_ERD_MAX_DDL_BYTES ?? 512_000);
  return Number.isFinite(n) ? Math.min(2_097_152, Math.max(16_384, Math.floor(n))) : 512_000;
}
