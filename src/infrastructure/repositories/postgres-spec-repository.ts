import { and, desc, eq, sql } from "drizzle-orm";
import { normalizeDiffSummary, type DiffSummary } from "@/domain/diff/openapi-diff";
import {
  getPostgresDb,
  pgSpecs,
  pgSpecVersions,
} from "@/infrastructure/database";
import { validateSpecId } from "@/lib/spec-id";
import type { HistoryEntry, SpecListItem } from "./contracts";
import type { ApiSpecification } from "./contracts";

function rowToHistoryEntry(row: {
  ts: number;
  version: string;
  note: string | null;
  summaryJson: unknown;
  isRestore: boolean | null;
}): HistoryEntry {
  return {
    ts: String(row.ts),
    version: row.version,
    note: row.note ?? undefined,
    summary: row.summaryJson
      ? normalizeDiffSummary(row.summaryJson as DiffSummary)
      : undefined,
    isRestore: row.isRestore ?? undefined,
  };
}

export class PostgresSpecRepository {
  async findAll(): Promise<SpecListItem[]> {
    return this.listSummaries();
  }

  async exists(id: string): Promise<boolean> {
    const row = await getPostgresDb().query.pgSpecs.findFirst({
      where: eq(pgSpecs.id, id),
      columns: { id: true },
    });
    return !!row;
  }

  async findById(id: string): Promise<ApiSpecification | null> {
    const row = await getPostgresDb().query.pgSpecs.findFirst({
      where: eq(pgSpecs.id, id),
    });
    if (!row) return null;
    return row.openapiJson as ApiSpecification;
  }

  async readHistory(id: string): Promise<HistoryEntry[]> {
    const rows = await getPostgresDb()
      .select({
        ts: pgSpecVersions.ts,
        version: pgSpecVersions.version,
        note: pgSpecVersions.note,
        summaryJson: pgSpecVersions.summaryJson,
        isRestore: pgSpecVersions.isRestore,
      })
      .from(pgSpecVersions)
      .where(eq(pgSpecVersions.specId, id))
      .orderBy(desc(pgSpecVersions.ts));
    return rows.map(rowToHistoryEntry);
  }

  async saveVersion(
    id: string,
    data: ApiSpecification,
    meta?: { note?: string; summary?: DiffSummary; isRestore?: boolean }
  ): Promise<string> {
    if (!validateSpecId(id)) {
      throw new Error("Invalid specification id");
    }

    const ts = Date.now();
    const version =
      (data.info as { version?: string } | undefined)?.version || "unknown";
    const now = new Date();

    await getPostgresDb()
      .insert(pgSpecs)
      .values({
        id,
        openapiJson: data,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: pgSpecs.id,
        set: { openapiJson: data, updatedAt: now },
      });

    await getPostgresDb().insert(pgSpecVersions).values({
      specId: id,
      ts,
      version,
      note: meta?.note ?? null,
      summaryJson: meta?.summary ?? null,
      isRestore: meta?.isRestore ?? false,
      snapshotJson: data,
    });

    return String(ts);
  }

  async readSnapshot(
    id: string,
    ts: string
  ): Promise<ApiSpecification | null> {
    if (ts === "current") {
      return this.findById(id);
    }

    const tsNum = Number(ts);
    if (!Number.isFinite(tsNum)) return null;

    const row = await getPostgresDb().query.pgSpecVersions.findFirst({
      where: and(
        eq(pgSpecVersions.specId, id),
        eq(pgSpecVersions.ts, tsNum)
      ),
      columns: { snapshotJson: true },
    });
    if (!row) return null;
    return row.snapshotJson as ApiSpecification;
  }

  async delete(id: string): Promise<void> {
    await getPostgresDb().delete(pgSpecs).where(eq(pgSpecs.id, id));
  }

  async deleteVersion(id: string, ts: string): Promise<void> {
    const tsNum = Number(ts);
    if (!Number.isFinite(tsNum)) return;
    await getPostgresDb()
      .delete(pgSpecVersions)
      .where(
        and(eq(pgSpecVersions.specId, id), eq(pgSpecVersions.ts, tsNum))
      );
  }

  async listSummaries(): Promise<SpecListItem[]> {
    const rows = await getPostgresDb()
      .select({
        id: pgSpecs.id,
        updatedAt: pgSpecs.updatedAt,
        openapiJson: pgSpecs.openapiJson,
        title: sql<string | null>`${pgSpecs.openapiJson}->'info'->>'title'`,
        version: sql<string | null>`${pgSpecs.openapiJson}->'info'->>'version'`,
        description: sql<string | null>`${pgSpecs.openapiJson}->'info'->>'description'`,
      })
      .from(pgSpecs);

    return rows.map((row) => {
      let title = row.title?.trim() || null;
      let version = row.version?.trim() || null;
      let description = row.description?.trim() || undefined;

      if (!title || !version) {
        const data = row.openapiJson as {
          info?: { title?: string; version?: string; description?: string };
        };
        title = title || data.info?.title?.trim() || null;
        version = version || data.info?.version?.trim() || null;
        if (!description) {
          const d = data.info?.description?.trim();
          if (d) description = d;
        }
      }

      return {
        id: row.id,
        title: title || row.id,
        description,
        version: version || "unknown",
        lastModified: row.updatedAt.toISOString(),
      };
    });
  }
}

export const postgresSpecRepository = new PostgresSpecRepository();
