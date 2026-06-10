import { createHash } from "crypto";
import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { liamErdCacheDir } from "@/domain/db/config";
import {
  getErdPasteFormatMeta,
  type ErdPasteFormat,
  validatePastedSchema,
} from "@/domain/db/erd-paste-schema";
import {
  erdBuildTimeoutMs,
  erdMaxTables,
  isAllowedErdAssetExtension,
  isValidConnectionId,
  isValidErdCacheKey,
} from "@/domain/db/erd-security";
import { snapshotToPgsqlDdl } from "@/domain/db/snapshot-to-pgsql";
import type { DbSchemaSnapshot } from "@/domain/db/types";
import { postgresDbConnectionRepository } from "@/infrastructure/repositories/postgres-db-connection-repository";

export type ErdBuildResult = {
  cacheKey: string;
  builtAt: string;
  tableCount: number;
  cached: boolean;
  viewerUrl: string;
};

export function erdCacheKeyFromSnapshot(snapshot: DbSchemaSnapshot): string {
  const hash = createHash("sha256")
    .update(snapshot.introspectedAt)
    .digest("hex")
    .slice(0, 16);
  return hash;
}

export function erdCacheKeyFromContent(content: string, format: ErdPasteFormat): string {
  const hash = createHash("sha256")
    .update(`${format}\0${content}`)
    .digest("hex")
    .slice(0, 16);
  return hash;
}

export function erdCachePath(connectionId: string, cacheKey: string): string {
  if (!isValidConnectionId(connectionId) || !isValidErdCacheKey(cacheKey)) {
    throw new Error("Invalid ERD cache path parameters");
  }
  return path.join(liamErdCacheDir(), connectionId, cacheKey);
}

export function erdPasteCachePath(specId: string, cacheKey: string): string {
  if (!specId.trim() || !isValidErdCacheKey(cacheKey)) {
    throw new Error("Invalid ERD paste cache path parameters");
  }
  return path.join(liamErdCacheDir(), "paste", specId, cacheKey);
}

function viewerAssetBaseUrl(
  connectionId: string,
  specId: string,
  cacheKey: string
): string {
  const params = new URLSearchParams({ specId });
  return `/api/db/connections/${connectionId}/erd/${cacheKey}/?${params.toString()}`;
}

function viewerPasteAssetBaseUrl(specId: string, cacheKey: string): string {
  return `/api/db/erd/${encodeURIComponent(specId)}/${cacheKey}/`;
}

function formatLiamSpawnError(err: Error): Error {
  const msg = err.message;
  if (
    msg.includes("ERR_MODULE_NOT_FOUND") ||
    /Cannot find package/i.test(msg)
  ) {
    return new Error(
      "Liam CLI runtime dependencies are missing (e.g. commander). Rebuild the Docker image so scripts/stage-liam-cli-deps.mjs runs, or run npm install locally."
    );
  }
  return err;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

type LiamBuildOptions = {
  format: string;
  inputBasename: string;
};

async function runLiamCliBuild(
  inputContent: string,
  outputDir: string,
  options: LiamBuildOptions = { format: "postgres", inputBasename: "schema.sql" }
): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });
  const inputPath = path.join(outputDir, options.inputBasename);
  await fs.writeFile(inputPath, inputContent, "utf8");

  const cliBin = path.join(
    process.cwd(),
    "node_modules",
    "@liam-hq",
    "cli",
    "dist-cli",
    "bin",
    "cli.js"
  );

  if (!(await pathExists(cliBin))) {
    throw new Error(
      "Liam CLI binary not found. Run npm install locally or rebuild the Docker image."
    );
  }

  const args = [
    "erd",
    "build",
    "--input",
    inputPath,
    "--format",
    options.format,
    "--output-dir",
    outputDir,
  ];

  const timeoutMs = erdBuildTimeoutMs();
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [cliBin, ...args], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      env: {
        NODE_ENV: process.env.NODE_ENV ?? "production",
        PATH: process.env.PATH ?? "",
        SystemRoot: process.env.SystemRoot,
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
        HOME: process.env.HOME,
        USERPROFILE: process.env.USERPROFILE,
      },
    });

    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Liam ERD build timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString().slice(0, 4000);
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(formatLiamSpawnError(err));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(formatLiamSpawnError(new Error(stderr.trim() || `Liam ERD build failed (exit ${code})`)));
    });
  });

  const indexPath = path.join(outputDir, "index.html");
  if (!(await pathExists(indexPath))) {
    throw new Error("Liam ERD build did not produce index.html");
  }
}

async function resolveErdAssetInCacheDir(
  cacheDir: string,
  assetSegments: string[]
): Promise<{ filePath: string; contentType: string } | null> {
  const segments =
    assetSegments.length === 0 ? ["index.html"] : assetSegments;

  const safeSegments = segments.filter(
    (s) => s && s !== ".." && !s.includes("..") && !s.includes("\\")
  );
  if (safeSegments.length !== segments.length) return null;

  const filePath = path.resolve(cacheDir, ...safeSegments);
  const resolvedCache = path.resolve(cacheDir);
  const relative = path.relative(resolvedCache, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }

  if (!(await pathExists(filePath))) return null;

  const ext = path.extname(filePath).toLowerCase();
  if (!isAllowedErdAssetExtension(ext)) return null;

  const contentType = contentTypeForExt(ext);
  return { filePath, contentType };
}

export async function ensureErdBuildFromPaste(input: {
  specId: string;
  content: string;
  format: ErdPasteFormat;
  force?: boolean;
}): Promise<ErdBuildResult> {
  const { content, tableCount } = validatePastedSchema({
    content: input.content,
    format: input.format,
  });
  const meta = getErdPasteFormatMeta(input.format);
  const cacheKey = erdCacheKeyFromContent(content, input.format);
  const cacheDir = erdPasteCachePath(input.specId, cacheKey);
  const indexPath = path.join(cacheDir, "index.html");

  let cached = false;
  let builtAt: string;

  if (!input.force && (await pathExists(indexPath))) {
    cached = true;
    const stat = await fs.stat(indexPath);
    builtAt = stat.mtime.toISOString();
  } else {
    await runLiamCliBuild(content, cacheDir, {
      format: meta.liamFormat,
      inputBasename: meta.inputBasename,
    });
    cached = false;
    builtAt = new Date().toISOString();
  }

  return {
    cacheKey,
    builtAt,
    tableCount,
    cached,
    viewerUrl: viewerPasteAssetBaseUrl(input.specId, cacheKey),
  };
}

export async function ensureErdBuild(input: {
  specId: string;
  connectionId: string;
  force?: boolean;
}): Promise<ErdBuildResult> {
  if (!isValidConnectionId(input.connectionId)) {
    throw new Error("Connection not found");
  }

  const row = await postgresDbConnectionRepository.findForSpec(
    input.specId,
    input.connectionId
  );
  if (!row) {
    throw new Error("Connection not found");
  }

  const snap = await postgresDbConnectionRepository.getLatestSchema(input.connectionId);
  if (!snap?.schemaJson) {
    throw new Error("No schema snapshot. Run Index schema first.");
  }

  const schema = snap.schemaJson as DbSchemaSnapshot;
  const tableCount = schema.tables?.length ?? 0;
  if (tableCount > erdMaxTables()) {
    throw new Error(
      `Schema has ${tableCount} tables; ERD limit is ${erdMaxTables()}. Narrow scope or raise LIAM_ERD_MAX_TABLES.`
    );
  }

  const cacheKey = erdCacheKeyFromSnapshot(schema);
  const cacheDir = erdCachePath(input.connectionId, cacheKey);
  const indexPath = path.join(cacheDir, "index.html");

  let cached = false;
  if (!input.force && (await pathExists(indexPath))) {
    cached = true;
  } else {
    const ddl = snapshotToPgsqlDdl(schema);
    await runLiamCliBuild(ddl, cacheDir);
    cached = false;
  }

  const builtAt = schema.introspectedAt;
  return {
    cacheKey,
    builtAt,
    tableCount,
    cached,
    viewerUrl: viewerAssetBaseUrl(input.connectionId, input.specId, cacheKey),
  };
}

export async function resolveErdPasteAssetPath(input: {
  specId: string;
  cacheKey: string;
  assetSegments: string[];
}): Promise<{ filePath: string; contentType: string } | null> {
  if (!input.specId.trim() || !isValidErdCacheKey(input.cacheKey)) {
    return null;
  }
  const cacheDir = erdPasteCachePath(input.specId, input.cacheKey);
  return resolveErdAssetInCacheDir(cacheDir, input.assetSegments);
}

export async function resolveErdAssetPath(input: {
  specId: string;
  connectionId: string;
  cacheKey: string;
  assetSegments: string[];
}): Promise<{ filePath: string; contentType: string } | null> {
  const row = await postgresDbConnectionRepository.findForSpec(
    input.specId,
    input.connectionId
  );
  if (!row) return null;

  const cacheDir = erdCachePath(input.connectionId, input.cacheKey);
  return resolveErdAssetInCacheDir(cacheDir, input.assetSegments);
}

function contentTypeForExt(ext: string): string {
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
    case ".mjs":
      return "application/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".wasm":
      return "application/wasm";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    default:
      return "application/octet-stream";
  }
}
