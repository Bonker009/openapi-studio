import { and, desc, eq, sql } from "drizzle-orm";
import { getPostgresDb } from "@/infrastructure/database/postgres-client";
import {
  pgDbConnections,
  pgDbConsentEvents,
  pgDbRagChunks,
  pgDbSchemaSnapshots,
} from "@/infrastructure/database/pg-flow-schema";
import type { DbConnectionPublic, DbConnectionStatus } from "@/domain/db/types";

function toPublic(
  row: typeof pgDbConnections.$inferSelect,
  extras?: { indexedChunkCount?: number; tableCount?: number }
): DbConnectionPublic {
  return {
    id: row.id,
    specId: row.specId,
    label: row.label,
    host: row.host,
    port: row.port,
    database: row.database,
    username: row.username,
    sslMode: row.sslMode,
    readOnly: row.readOnly,
    termsVersion: row.termsVersion,
    acceptedAt: row.acceptedAt.toISOString(),
    status: row.status as DbConnectionStatus,
    lastTestedAt: row.lastTestedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    indexedChunkCount: extras?.indexedChunkCount,
    tableCount: extras?.tableCount,
  };
}

export class PostgresDbConnectionRepository {
  async create(input: {
    specId: string;
    label: string;
    host: string;
    port: number;
    database: string;
    username: string;
    encryptedSecret: string;
    sslMode: string;
    termsVersion: string;
    acceptedAt: Date;
  }) {
    const db = getPostgresDb();
    const [row] = await db
      .insert(pgDbConnections)
      .values({
        specId: input.specId,
        label: input.label,
        host: input.host,
        port: input.port,
        database: input.database,
        username: input.username,
        encryptedSecret: input.encryptedSecret,
        sslMode: input.sslMode,
        readOnly: true,
        termsVersion: input.termsVersion,
        acceptedAt: input.acceptedAt,
        status: "pending",
      })
      .returning();
    return row;
  }

  async findById(id: string) {
    const db = getPostgresDb();
    const [row] = await db
      .select()
      .from(pgDbConnections)
      .where(eq(pgDbConnections.id, id))
      .limit(1);
    return row ?? null;
  }

  async listBySpecId(specId: string): Promise<DbConnectionPublic[]> {
    const db = getPostgresDb();
    const rows = await db
      .select()
      .from(pgDbConnections)
      .where(eq(pgDbConnections.specId, specId))
      .orderBy(desc(pgDbConnections.updatedAt));

    const out: DbConnectionPublic[] = [];
    for (const row of rows) {
      const [chunkCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(pgDbRagChunks)
        .where(eq(pgDbRagChunks.connectionId, row.id));
      const [snap] = await db
        .select()
        .from(pgDbSchemaSnapshots)
        .where(eq(pgDbSchemaSnapshots.connectionId, row.id))
        .orderBy(desc(pgDbSchemaSnapshots.createdAt))
        .limit(1);
      out.push(
        toPublic(row, {
          indexedChunkCount: chunkCount?.count ?? 0,
          tableCount: snap?.tableCount ?? undefined,
        })
      );
    }
    return out;
  }

  async updateStatus(
    id: string,
    status: DbConnectionStatus,
    lastTestedAt?: Date
  ) {
    const db = getPostgresDb();
    await db
      .update(pgDbConnections)
      .set({
        status,
        lastTestedAt: lastTestedAt ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(pgDbConnections.id, id));
  }

  async delete(id: string) {
    const db = getPostgresDb();
    await db.delete(pgDbConnections).where(eq(pgDbConnections.id, id));
  }

  async recordConsent(input: {
    connectionId?: string;
    specId: string;
    action: string;
    termsVersion: string;
  }) {
    const db = getPostgresDb();
    await db.insert(pgDbConsentEvents).values(input);
  }

  async saveSchemaSnapshot(
    connectionId: string,
    schemaJson: unknown,
    tableCount: number
  ) {
    const db = getPostgresDb();
    await db.insert(pgDbSchemaSnapshots).values({
      connectionId,
      schemaJson,
      tableCount,
    });
  }

  async getLatestSchema(connectionId: string) {
    const db = getPostgresDb();
    const [row] = await db
      .select()
      .from(pgDbSchemaSnapshots)
      .where(eq(pgDbSchemaSnapshots.connectionId, connectionId))
      .orderBy(desc(pgDbSchemaSnapshots.createdAt))
      .limit(1);
    return row ?? null;
  }

  async findForSpec(specId: string, connectionId: string) {
    const db = getPostgresDb();
    const [row] = await db
      .select()
      .from(pgDbConnections)
      .where(
        and(
          eq(pgDbConnections.id, connectionId),
          eq(pgDbConnections.specId, specId)
        )
      )
      .limit(1);
    return row ?? null;
  }
}

export const postgresDbConnectionRepository =
  new PostgresDbConnectionRepository();
