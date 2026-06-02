import { AI_DEFAULTS } from "@/domain/ai/config";
import type { RetrievedChunk } from "@/domain/ai/types";
import { createEmbedding } from "@/infrastructure/ai/openai-client";
import { PostgresAiRepository } from "@/infrastructure/ai/repositories/postgres-ai-repository";
import {
  computeRecallScore,
  computeRerankScore,
  cosineSimilarity,
  lexicalScore,
  type OpenApiChunkSignals,
} from "@/infrastructure/ai/rag/embedding-math";

type ChunkRow = Awaited<
  ReturnType<PostgresAiRepository["listChunks"]>
>[number];

function controllerFromMetadata(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== "object") return undefined;
  const controller = (metadata as { controller?: unknown }).controller;
  return typeof controller === "string" && controller.trim()
    ? controller.trim()
    : undefined;
}

function rowToSignals(row: ChunkRow): OpenApiChunkSignals {
  return {
    title: row.title,
    content: row.content,
    endpointKey: row.endpointKey ?? undefined,
    controller: controllerFromMetadata(row.metadata),
  };
}

/** Exported for unit tests. */
export function recallAndRerankChunks(input: {
  query: string;
  rows: ChunkRow[];
  queryEmbedding: number[] | null;
  finalLimit: number;
}): RetrievedChunk[] {
  const recallPoolSize = Math.min(
    input.rows.length,
    AI_DEFAULTS.ragRecallPoolSize
  );
  const recallWeights = AI_DEFAULTS.ragRecallWeights;
  const rerankWeights = AI_DEFAULTS.ragRerankWeights;

  const recalled = input.rows
    .map((row) => {
      const signals = rowToSignals(row);
      const docText = `${row.title} ${row.content} ${row.endpointKey ?? ""} ${
        signals.controller ?? ""
      }`;
      const embedding = row.embeddingJson as number[] | null;
      const semantic =
        input.queryEmbedding && embedding?.length
          ? cosineSimilarity(input.queryEmbedding, embedding)
          : 0;
      const lexical = lexicalScore(input.query, docText);
      const recallScore = computeRecallScore({
        semantic,
        lexical,
        weights: recallWeights,
      });
      return { row, signals, recallScore };
    })
    .filter((c) => c.recallScore >= AI_DEFAULTS.ragRecallMinScore)
    .sort((a, b) => b.recallScore - a.recallScore)
    .slice(0, recallPoolSize);

  const reranked = recalled
    .map((candidate) => {
      const score = computeRerankScore({
        recallScore: candidate.recallScore,
        query: input.query,
        chunk: candidate.signals,
        weights: rerankWeights,
      });
      return { ...candidate, score };
    })
    .filter((c) => c.score >= AI_DEFAULTS.ragFinalMinScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, input.finalLimit);

  return reranked.map(({ row, signals, score }) => ({
    id: row.id,
    chunkType: row.chunkType as RetrievedChunk["chunkType"],
    endpointKey: row.endpointKey ?? undefined,
    controller: signals.controller,
    title: row.title,
    content: row.content,
    score,
  }));
}

export class OpenApiRetriever {
  constructor(private readonly repo = new PostgresAiRepository()) {}

  async retrieve(input: {
    specId: string;
    query: string;
    limit?: number;
  }): Promise<RetrievedChunk[]> {
    const finalLimit = Math.min(
      input.limit ?? AI_DEFAULTS.maxRetrievedChunks,
      AI_DEFAULTS.maxRetrievedChunksCap
    );
    const rows = await this.repo.listChunks(input.specId);
    if (rows.length === 0) return [];

    let queryEmbedding: number[] | null = null;
    try {
      queryEmbedding = await createEmbedding(input.query);
    } catch {
      queryEmbedding = null;
    }

    return recallAndRerankChunks({
      query: input.query,
      rows,
      queryEmbedding,
      finalLimit,
    });
  }

  async listAllowedEndpoints(specId: string): Promise<string[]> {
    const rows = await this.repo.listEndpoints(specId);
    return rows.map((r) => r.endpointKey);
  }
}
