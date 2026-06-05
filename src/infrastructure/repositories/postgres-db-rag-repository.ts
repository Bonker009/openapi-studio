import { eq } from "drizzle-orm";
import { getPostgresDb } from "@/infrastructure/database/postgres-client";
import { pgDbQueryAudit, pgDbRagChunks } from "@/infrastructure/database/pg-flow-schema";
import { createEmbedding } from "@/infrastructure/ai/openai-client";

export type DbChunkRow = typeof pgDbRagChunks.$inferSelect;

export class PostgresDbRagRepository {
  async deleteChunksForConnection(connectionId: string) {
    const db = getPostgresDb();
    await db
      .delete(pgDbRagChunks)
      .where(eq(pgDbRagChunks.connectionId, connectionId));
  }

  async upsertChunk(input: {
    connectionId: string;
    chunkKey: string;
    tableName: string;
    title: string;
    content: string;
    metadata?: Record<string, unknown>;
  }) {
    const db = getPostgresDb();
    let embeddingJson: number[] | null = null;
    try {
      embeddingJson = await createEmbedding(
        `${input.title}\n${input.content}`
      );
    } catch {
      embeddingJson = null;
    }

    await db
      .insert(pgDbRagChunks)
      .values({
        connectionId: input.connectionId,
        chunkKey: input.chunkKey,
        tableName: input.tableName,
        title: input.title,
        content: input.content,
        metadata: input.metadata ?? {},
        embeddingJson,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [pgDbRagChunks.connectionId, pgDbRagChunks.chunkKey],
        set: {
          tableName: input.tableName,
          title: input.title,
          content: input.content,
          metadata: input.metadata ?? {},
          embeddingJson,
          updatedAt: new Date(),
        },
      });
  }

  async listChunks(connectionId: string): Promise<DbChunkRow[]> {
    const db = getPostgresDb();
    return db
      .select()
      .from(pgDbRagChunks)
      .where(eq(pgDbRagChunks.connectionId, connectionId));
  }

  async recordQueryAudit(input: {
    connectionId: string;
    sqlHash: string;
    sqlPreview: string;
    rowCount?: number;
    durationMs?: number;
    success: boolean;
    errorMessage?: string;
    source?: string;
  }) {
    const db = getPostgresDb();
    await db.insert(pgDbQueryAudit).values({
      connectionId: input.connectionId,
      sqlHash: input.sqlHash,
      sqlPreview: input.sqlPreview,
      rowCount: input.rowCount,
      durationMs: input.durationMs,
      success: input.success,
      errorMessage: input.errorMessage,
      source: input.source ?? "agent",
    });
  }
}

export const postgresDbRagRepository = new PostgresDbRagRepository();
