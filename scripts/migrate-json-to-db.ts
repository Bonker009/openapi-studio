import fs from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import { DATA_DIR } from "../lib/db/client";
import { getDb } from "../lib/db/client";
import { runMigrations } from "../lib/db/migrate";
import {
  specs,
  specVersions,
  endpointStatuses,
  specSettings,
} from "../lib/db/schema";
import type { HistoryEntry } from "../lib/db/repositories";
import { validateSpecId } from "../lib/spec-id";

const SPECS_DIR = path.join(DATA_DIR, "specs");
const STATUS_DIR = path.join(DATA_DIR, "status");
const SETTINGS_DIR = path.join(DATA_DIR, "settings");
const LEGACY_VERSIONED_REGEX = /^(.+)_(\d{13,})$/;

function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
}

function listCanonicalSpecIds(): string[] {
  if (!fs.existsSync(SPECS_DIR)) return [];
  return fs
    .readdirSync(SPECS_DIR)
    .filter((file) => {
      if (!file.endsWith(".json")) return false;
      const id = file.replace(/\.json$/, "");
      if (!validateSpecId(id)) return false;
      if (LEGACY_VERSIONED_REGEX.test(id)) return false;
      return fs.statSync(path.join(SPECS_DIR, file)).isFile();
    })
    .map((file) => file.replace(/\.json$/, ""));
}

function collectLegacySnapshots(id: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!fs.existsSync(SPECS_DIR)) return map;
  for (const file of fs.readdirSync(SPECS_DIR)) {
    if (!file.endsWith(".json")) continue;
    const base = file.replace(/\.json$/, "");
    const match = base.match(LEGACY_VERSIONED_REGEX);
    if (!match || match[1] !== id) continue;
    map.set(match[2], path.join(SPECS_DIR, file));
  }
  return map;
}

function upsertSpec(
  id: string,
  openapiJson: string,
  updatedAt: number
): void {
  getDb()
    .insert(specs)
    .values({ id, openapiJson, updatedAt })
    .onConflictDoUpdate({
      target: specs.id,
      set: { openapiJson, updatedAt },
    })
    .run();
}

function insertVersion(
  specId: string,
  ts: number,
  snapshotJson: string,
  meta?: Partial<HistoryEntry>
): void {
  let data: { info?: { version?: string } };
  try {
    data = JSON.parse(snapshotJson);
  } catch {
    return;
  }
  const version = data.info?.version || meta?.version || "unknown";
  getDb()
    .insert(specVersions)
    .values({
      specId,
      ts,
      version,
      note: meta?.note ?? null,
      summaryJson: meta?.summary ? JSON.stringify(meta.summary) : null,
      isRestore: meta?.isRestore ?? false,
      snapshotJson,
    })
    .onConflictDoNothing()
    .run();
}

function importSpecVersions(id: string, historyByTs: Map<string, HistoryEntry>): void {
  const versionsDir = path.join(SPECS_DIR, id, "versions");
  const legacy = collectLegacySnapshots(id);
  const seen = new Set<string>();

  if (fs.existsSync(versionsDir)) {
    for (const file of fs.readdirSync(versionsDir)) {
      if (!file.endsWith(".json")) continue;
      const ts = file.replace(/\.json$/, "");
      const filePath = path.join(versionsDir, file);
      const snapshotJson = fs.readFileSync(filePath, "utf-8");
      insertVersion(id, Number(ts), snapshotJson, historyByTs.get(ts));
      seen.add(ts);
    }
  }

  for (const [ts, filePath] of legacy) {
    if (seen.has(ts)) continue;
    const snapshotJson = fs.readFileSync(filePath, "utf-8");
    insertVersion(id, Number(ts), snapshotJson, historyByTs.get(ts));
    seen.add(ts);
  }

  for (const [ts, entry] of historyByTs) {
    if (seen.has(ts)) continue;
    const canonical = path.join(SPECS_DIR, `${id}.json`);
    if (!fs.existsSync(canonical)) continue;
    const snapshotJson = fs.readFileSync(canonical, "utf-8");
    insertVersion(id, Number(ts), snapshotJson, entry);
  }
}

function importStatus(id: string): void {
  const filePath = path.join(STATUS_DIR, `${id}.json`);
  const rows = readJsonFile<
    { path: string; method: string; working: boolean; notes?: string }[]
  >(filePath);
  if (!rows || !Array.isArray(rows) || rows.length === 0) return;

  const db = getDb();
  db.delete(endpointStatuses).where(eq(endpointStatuses.specId, id)).run();
  db.insert(endpointStatuses)
    .values(
      rows.map((r) => ({
        specId: id,
        path: r.path,
        method: r.method,
        working: r.working,
        notes: r.notes ?? "",
      }))
    )
    .run();
}

function importSettings(id: string): void {
  const filePath = path.join(SETTINGS_DIR, `${id}.json`);
  const data = readJsonFile<{ expandedControllers?: Record<string, boolean> }>(
    filePath
  );
  if (!data) return;
  getDb()
    .insert(specSettings)
    .values({
      specId: id,
      expandedControllersJson: JSON.stringify(data),
    })
    .onConflictDoUpdate({
      target: specSettings.specId,
      set: { expandedControllersJson: JSON.stringify(data) },
    })
    .run();
}

function main(): void {
  runMigrations();
  const db = getDb();
  const ids = listCanonicalSpecIds();

  if (ids.length === 0) {
    console.log("No JSON specs found under data/specs — nothing to import.");
    return;
  }

  for (const id of ids) {
    const canonicalPath = path.join(SPECS_DIR, `${id}.json`);
    const openapiJson = fs.readFileSync(canonicalPath, "utf-8");
    const updatedAt = fs.statSync(canonicalPath).mtimeMs;
    upsertSpec(id, openapiJson, updatedAt);

    const historyPath = path.join(SPECS_DIR, id, "history.json");
    const history = readJsonFile<HistoryEntry[]>(historyPath) ?? [];
    const historyByTs = new Map(history.map((e) => [e.ts, e]));

    importSpecVersions(id, historyByTs);
    importStatus(id);
    importSettings(id);

    console.log(`Imported spec: ${id}`);
  }

  const specCount = db.select().from(specs).all().length;
  const versionCount = db.select().from(specVersions).all().length;
  console.log(
    `Done. ${specCount} spec(s), ${versionCount} version row(s) in database.`
  );
}

main();
