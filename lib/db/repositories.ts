import { and, desc, eq } from "drizzle-orm";
import type { DiffSummary } from "@/lib/openapi-diff";
import { getDb } from "./client";
import {
  specs,
  specVersions,
  endpointStatuses,
  specSettings,
} from "./schema";
import { runMigrations } from "./migrate";

export type HistoryEntry = {
  ts: string;
  version: string;
  note?: string;
  summary?: DiffSummary;
  isRestore?: boolean;
};

export type EndpointStatusRow = {
  path: string;
  method: string;
  working: boolean;
  notes: string;
};

export type SpecSettingsData = {
  expandedControllers: Record<string, boolean>;
};

import { validateSpecId } from "@/lib/spec-id";

export { validateSpecId };

function ensureMigrated(): void {
  runMigrations();
}

function parseJson<T>(raw: string): T {
  return JSON.parse(raw) as T;
}

function rowToHistoryEntry(row: {
  ts: number;
  version: string;
  note: string | null;
  summaryJson: string | null;
  isRestore: boolean | null;
}): HistoryEntry {
  return {
    ts: String(row.ts),
    version: row.version,
    note: row.note ?? undefined,
    summary: row.summaryJson
      ? (parseJson(row.summaryJson) as DiffSummary)
      : undefined,
    isRestore: row.isRestore ?? undefined,
  };
}

export function specExists(id: string): boolean {
  ensureMigrated();
  const row = getDb().select().from(specs).where(eq(specs.id, id)).get();
  return !!row;
}

export function getSpec(
  id: string
): Record<string, unknown> | null {
  ensureMigrated();
  const row = getDb().select().from(specs).where(eq(specs.id, id)).get();
  if (!row) return null;
  return parseJson(row.openapiJson);
}

export function readHistory(id: string): HistoryEntry[] {
  ensureMigrated();
  const rows = getDb()
    .select({
      ts: specVersions.ts,
      version: specVersions.version,
      note: specVersions.note,
      summaryJson: specVersions.summaryJson,
      isRestore: specVersions.isRestore,
    })
    .from(specVersions)
    .where(eq(specVersions.specId, id))
    .orderBy(desc(specVersions.ts))
    .all();
  return rows.map(rowToHistoryEntry);
}

export function saveSpecVersion(
  id: string,
  data: Record<string, unknown>,
  meta?: { note?: string; summary?: DiffSummary; isRestore?: boolean }
): string {
  if (!validateSpecId(id)) {
    throw new Error("Invalid specification id");
  }
  ensureMigrated();

  const ts = Date.now();
  const payload = JSON.stringify(data);
  const version =
    (data.info as { version?: string } | undefined)?.version || "unknown";
  const now = Date.now();
  const db = getDb();

  db.insert(specs)
    .values({
      id,
      openapiJson: payload,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: specs.id,
      set: { openapiJson: payload, updatedAt: now },
    })
    .run();

  db.insert(specVersions)
    .values({
      specId: id,
      ts,
      version,
      note: meta?.note ?? null,
      summaryJson: meta?.summary ? JSON.stringify(meta.summary) : null,
      isRestore: meta?.isRestore ?? false,
      snapshotJson: payload,
    })
    .run();

  return String(ts);
}

export function readSpecSnapshot(
  id: string,
  ts: string
): Record<string, unknown> | null {
  ensureMigrated();

  if (ts === "current") {
    return getSpec(id);
  }

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return null;

  const row = getDb()
    .select({ snapshotJson: specVersions.snapshotJson })
    .from(specVersions)
    .where(and(eq(specVersions.specId, id), eq(specVersions.ts, tsNum)))
    .get();

  if (!row) return null;
  return parseJson(row.snapshotJson);
}

export function deleteSpecFully(id: string): void {
  ensureMigrated();
  getDb().delete(specs).where(eq(specs.id, id)).run();
}

export function deleteVersionSnapshot(id: string, ts: string): void {
  ensureMigrated();
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return;
  getDb()
    .delete(specVersions)
    .where(and(eq(specVersions.specId, id), eq(specVersions.ts, tsNum)))
    .run();
}

export function listCanonicalSpecIds(): string[] {
  ensureMigrated();
  const rows = getDb().select({ id: specs.id }).from(specs).all();
  return rows.map((r) => r.id);
}

export type SpecListItem = {
  id: string;
  title: string;
  version: string;
  lastModified: string;
};

export function listSpecSummaries(): SpecListItem[] {
  ensureMigrated();
  const rows = getDb().select().from(specs).all();
  return rows.map((row) => {
    try {
      const data = parseJson<{ info?: { title?: string; version?: string } }>(
        row.openapiJson
      );
      return {
        id: row.id,
        title: data.info?.title || row.id,
        version: data.info?.version || "unknown",
        lastModified: new Date(row.updatedAt).toISOString(),
      };
    } catch {
      return {
        id: row.id,
        title: row.id,
        version: "unknown",
        lastModified: new Date(row.updatedAt).toISOString(),
      };
    }
  });
}

export function getEndpointStatuses(id: string): EndpointStatusRow[] | null {
  ensureMigrated();
  const rows = getDb()
    .select()
    .from(endpointStatuses)
    .where(eq(endpointStatuses.specId, id))
    .all();
  if (rows.length === 0) return null;
  return rows.map((r) => ({
    path: r.path,
    method: r.method,
    working: r.working,
    notes: r.notes,
  }));
}

export function saveEndpointStatuses(
  id: string,
  data: EndpointStatusRow[]
): void {
  ensureMigrated();
  const db = getDb();
  db.delete(endpointStatuses)
    .where(eq(endpointStatuses.specId, id))
    .run();
  if (data.length === 0) return;
  db.insert(endpointStatuses)
    .values(
      data.map((row) => ({
        specId: id,
        path: row.path,
        method: row.method,
        working: row.working,
        notes: row.notes ?? "",
      }))
    )
    .run();
}

export function deleteEndpointStatuses(id: string): void {
  ensureMigrated();
  getDb()
    .delete(endpointStatuses)
    .where(eq(endpointStatuses.specId, id))
    .run();
}

export function getSpecSettings(id: string): SpecSettingsData | null {
  ensureMigrated();
  const row = getDb()
    .select()
    .from(specSettings)
    .where(eq(specSettings.specId, id))
    .get();
  if (!row) return null;
  try {
    const parsed = parseJson<{ expandedControllers?: Record<string, boolean> }>(
      row.expandedControllersJson
    );
    return {
      expandedControllers: parsed.expandedControllers ?? {},
    };
  } catch {
    return { expandedControllers: {} };
  }
}

export function saveSpecSettings(id: string, data: SpecSettingsData): void {
  ensureMigrated();
  const payload = JSON.stringify(data);
  getDb()
    .insert(specSettings)
    .values({
      specId: id,
      expandedControllersJson: payload,
    })
    .onConflictDoUpdate({
      target: specSettings.specId,
      set: { expandedControllersJson: payload },
    })
    .run();
}

export function deleteSpecSettings(id: string): void {
  ensureMigrated();
  getDb().delete(specSettings).where(eq(specSettings.specId, id)).run();
}
