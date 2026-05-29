import { and, desc, eq, sql } from "drizzle-orm";
import { normalizeDiffSummary, type DiffSummary } from "@/lib/openapi-diff";
import { getDb } from "./client";
import {
  specs,
  specVersions,
  endpointStatuses,
  specSettings,
  endpointNotes,
  flows,
} from "./schema";
import type { Flow } from "@/lib/flows/types";
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
      ? normalizeDiffSummary(parseJson(row.summaryJson))
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
  description?: string;
  version: string;
  lastModified: string;
};

export function listSpecSummaries(): SpecListItem[] {
  ensureMigrated();
  const rows = getDb()
    .select({
      id: specs.id,
      updatedAt: specs.updatedAt,
      openapiJson: specs.openapiJson,
      title: sql<string | null>`json_extract(${specs.openapiJson}, '$.info.title')`,
      version: sql<string | null>`json_extract(${specs.openapiJson}, '$.info.version')`,
      description: sql<string | null>`json_extract(${specs.openapiJson}, '$.info.description')`,
    })
    .from(specs)
    .all();

  return rows.map((row) => {
    let title = row.title?.trim() || null;
    let version = row.version?.trim() || null;
    let description = row.description?.trim() || undefined;

    if (!title || !version) {
      try {
        const data = parseJson<{
          info?: { title?: string; version?: string; description?: string };
        }>(row.openapiJson);
        title = title || data.info?.title?.trim() || null;
        version = version || data.info?.version?.trim() || null;
        if (!description) {
          const d = data.info?.description?.trim();
          if (d) description = d;
        }
      } catch {
        /* use fallbacks below */
      }
    }

    return {
      id: row.id,
      title: title || row.id,
      description,
      version: version || "unknown",
      lastModified: new Date(row.updatedAt).toISOString(),
    };
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

export type EndpointNoteRow = {
  id: number;
  specId: string;
  path: string;
  method: string;
  ts: number;
  kind: string;
  body: string;
};

export function listEndpointNotes(
  specId: string,
  path: string,
  method: string
): EndpointNoteRow[] {
  ensureMigrated();
  const methodLower = method.toLowerCase();
  return getDb()
    .select()
    .from(endpointNotes)
    .where(
      and(
        eq(endpointNotes.specId, specId),
        eq(endpointNotes.path, path),
        eq(endpointNotes.method, methodLower)
      )
    )
    .orderBy(desc(endpointNotes.ts))
    .all();
}

export function appendEndpointNote(
  specId: string,
  path: string,
  method: string,
  input: { body: string; kind?: string }
): EndpointNoteRow {
  ensureMigrated();
  const ts = Date.now();
  const methodLower = method.toLowerCase();
  const db = getDb();
  const result = db
    .insert(endpointNotes)
    .values({
      specId,
      path,
      method: methodLower,
      ts,
      kind: input.kind?.trim() || "note",
      body: input.body.trim(),
    })
    .returning()
    .get();
  return result;
}

export function deleteEndpointNote(specId: string, noteId: number): boolean {
  ensureMigrated();
  const db = getDb();
  const row = db
    .select({ id: endpointNotes.id })
    .from(endpointNotes)
    .where(
      and(eq(endpointNotes.specId, specId), eq(endpointNotes.id, noteId))
    )
    .get();
  if (!row) return false;
  db.delete(endpointNotes)
    .where(and(eq(endpointNotes.specId, specId), eq(endpointNotes.id, noteId)))
    .run();
  return true;
}

function parseFlowJson(raw: string): Flow | null {
  try {
    const parsed = JSON.parse(raw) as Flow;
    if (!parsed?.id || !parsed?.specId || !Array.isArray(parsed.steps)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function listFlows(specId: string): Flow[] {
  ensureMigrated();
  const rows = getDb()
    .select()
    .from(flows)
    .where(eq(flows.specId, specId))
    .orderBy(desc(flows.updatedAt))
    .all();
  const result: Flow[] = [];
  for (const row of rows) {
    const flow = parseFlowJson(row.flowJson);
    if (flow) result.push(flow);
  }
  return result;
}

export function getFlow(specId: string, flowId: string): Flow | null {
  ensureMigrated();
  const row = getDb()
    .select()
    .from(flows)
    .where(and(eq(flows.specId, specId), eq(flows.id, flowId)))
    .get();
  if (!row) return null;
  return parseFlowJson(row.flowJson);
}

export function saveFlow(flow: Flow): Flow {
  ensureMigrated();
  const now = Date.now();
  const normalized: Flow = {
    ...flow,
    createdAt: flow.createdAt || now,
    updatedAt: now,
    onStepFailure: flow.onStepFailure ?? "stop",
    steps: flow.steps ?? [],
  };
  const db = getDb();
  const existing = db
    .select({ id: flows.id })
    .from(flows)
    .where(and(eq(flows.specId, flow.specId), eq(flows.id, flow.id)))
    .get();
  if (existing) {
    db.update(flows)
      .set({
        name: normalized.name.trim() || "Untitled flow",
        flowJson: JSON.stringify(normalized),
        updatedAt: now,
      })
      .where(and(eq(flows.specId, flow.specId), eq(flows.id, flow.id)))
      .run();
  } else {
    db.insert(flows)
      .values({
        id: normalized.id,
        specId: normalized.specId,
        name: normalized.name.trim() || "Untitled flow",
        flowJson: JSON.stringify(normalized),
        createdAt: normalized.createdAt,
        updatedAt: now,
      })
      .run();
  }
  return normalized;
}

export function deleteFlow(specId: string, flowId: string): boolean {
  ensureMigrated();
  const db = getDb();
  const row = db
    .select({ id: flows.id })
    .from(flows)
    .where(and(eq(flows.specId, specId), eq(flows.id, flowId)))
    .get();
  if (!row) return false;
  db.delete(flows)
    .where(and(eq(flows.specId, specId), eq(flows.id, flowId)))
    .run();
  return true;
}
