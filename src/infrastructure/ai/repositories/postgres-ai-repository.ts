import { eq, and } from "drizzle-orm";
import { getPostgresDb } from "@/infrastructure/database/postgres-client";
import {
  pgAiConversations,
  pgAiGenerations,
  pgAiMessages,
  pgEndpointIndex,
  pgFlowAiCache,
  pgOpenapiChunks,
} from "@/infrastructure/database/pg-flow-schema";
import type { FlowSchema } from "@/domain/ai/types";
import type { Flow } from "@/domain/flows/types";
import { buildEndpointCatalog } from "@/domain/ai/validation/endpoint-catalog";
import { chunkOpenApiSpec } from "@/infrastructure/ai/rag/openapi-chunker";
import { createEmbedding } from "@/infrastructure/ai/openai-client";

export class PostgresAiRepository {
  async indexOpenApi(
    specId: string,
    openapiJson: Record<string, unknown>
  ): Promise<{ chunkCount: number; endpointCount: number }> {
    const db = getPostgresDb();
    await db.delete(pgOpenapiChunks).where(eq(pgOpenapiChunks.specId, specId));
    await db.delete(pgEndpointIndex).where(eq(pgEndpointIndex.specId, specId));

    const catalog = buildEndpointCatalog(openapiJson);
    for (const ep of catalog) {
      await db.insert(pgEndpointIndex).values({
        specId,
        endpointKey: ep.endpointKey,
        method: ep.method,
        path: ep.path,
        requiresAuth: ep.requiresAuth,
        summary: ep.summary,
        searchText: `${ep.method} ${ep.path} ${ep.summary ?? ""}`.toLowerCase(),
        metadata: {},
      });
    }

    const drafts = chunkOpenApiSpec(specId, openapiJson);
    for (const draft of drafts) {
      let embeddingJson: number[] | null = null;
      try {
        embeddingJson = await createEmbedding(`${draft.title}\n${draft.content}`);
      } catch {
        embeddingJson = null;
      }
      await db.insert(pgOpenapiChunks).values({
        specId,
        chunkKey: draft.chunkKey,
        chunkType: draft.chunkType,
        endpointKey: draft.endpointKey,
        title: draft.title,
        content: draft.content,
        metadata: draft.metadata,
        embeddingJson,
      });
    }

    return { chunkCount: drafts.length, endpointCount: catalog.length };
  }

  async listChunks(specId: string) {
    const db = getPostgresDb();
    return db
      .select()
      .from(pgOpenapiChunks)
      .where(eq(pgOpenapiChunks.specId, specId));
  }

  async listEndpoints(specId: string) {
    const db = getPostgresDb();
    return db
      .select()
      .from(pgEndpointIndex)
      .where(eq(pgEndpointIndex.specId, specId));
  }

  async getFlowCache(specId: string, cacheKey: string) {
    const db = getPostgresDb();
    const rows = await db
      .select()
      .from(pgFlowAiCache)
      .where(and(eq(pgFlowAiCache.specId, specId), eq(pgFlowAiCache.cacheKey, cacheKey)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      flowSchema: row.flowSchemaJson as FlowSchema,
      internalFlow: row.internalFlowJson as Flow,
    };
  }

  async setFlowCache(input: {
    specId: string;
    cacheKey: string;
    flowSchema: FlowSchema;
    internalFlow: Flow;
    metadata?: Record<string, unknown>;
  }) {
    const db = getPostgresDb();
    await db
      .insert(pgFlowAiCache)
      .values({
        specId: input.specId,
        cacheKey: input.cacheKey,
        flowSchemaJson: input.flowSchema,
        internalFlowJson: input.internalFlow,
        metadata: input.metadata ?? {},
      })
      .onConflictDoUpdate({
        target: [pgFlowAiCache.specId, pgFlowAiCache.cacheKey],
        set: {
          flowSchemaJson: input.flowSchema,
          internalFlowJson: input.internalFlow,
          metadata: input.metadata ?? {},
        },
      });
  }

  async recordGeneration(input: {
    specId: string;
    kind: string;
    status: string;
    attempt: number;
    inputJson: Record<string, unknown>;
    outputJson: Record<string, unknown>;
    validationJson: Record<string, unknown>;
    conversationId?: string;
  }) {
    const db = getPostgresDb();
    const [row] = await db
      .insert(pgAiGenerations)
      .values({
        specId: input.specId,
        kind: input.kind,
        status: input.status,
        attempt: input.attempt,
        inputJson: input.inputJson,
        outputJson: input.outputJson,
        validationJson: input.validationJson,
        conversationId: input.conversationId,
      })
      .returning({ id: pgAiGenerations.id });
    return row.id;
  }

  async appendMessage(input: {
    conversationId: string;
    role: string;
    content: string;
    metadata?: Record<string, unknown>;
  }) {
    const db = getPostgresDb();
    await db.insert(pgAiMessages).values({
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      metadata: input.metadata ?? {},
    });
  }

  async createConversation(input: {
    specId: string;
    kind: string;
    title?: string;
  }) {
    const db = getPostgresDb();
    const [row] = await db
      .insert(pgAiConversations)
      .values({
        specId: input.specId,
        kind: input.kind,
        title: input.title,
      })
      .returning({ id: pgAiConversations.id });
    return row.id;
  }
}
