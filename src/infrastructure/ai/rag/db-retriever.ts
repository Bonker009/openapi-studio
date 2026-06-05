import { AI_DEFAULTS } from "@/domain/ai/config";
import type { RetrievedChunk } from "@/domain/ai/types";
import { createEmbedding } from "@/infrastructure/ai/openai-client";
import {
  computeRecallScore,
  computeRerankScore,
  cosineSimilarity,
  lexicalScore,
  type OpenApiChunkSignals,
} from "@/infrastructure/ai/rag/embedding-math";
import { postgresDbRagRepository } from "@/infrastructure/repositories/postgres-db-rag-repository";
import type { DbChunkRow } from "@/infrastructure/repositories/postgres-db-rag-repository";

function rowToSignals(row: DbChunkRow): OpenApiChunkSignals {
  return {
    title: row.title,
    content: row.content,
    endpointKey: row.tableName,
  };
}

export function recallAndRerankDbChunks(input: {
  query: string;
  rows: DbChunkRow[];
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
      const docText = `${row.title} ${row.content} ${row.tableName}`;
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

  return reranked.map(({ row, score }) => ({
    id: row.id,
    chunkType: "db_schema" as RetrievedChunk["chunkType"],
    endpointKey: row.tableName,
    title: row.title,
    content: row.content,
    score,
  }));
}

export class DbRetriever {
  async retrieve(input: {
    connectionId: string;
    query: string;
    limit?: number;
  }): Promise<RetrievedChunk[]> {
    const finalLimit = Math.min(
      input.limit ?? AI_DEFAULTS.maxRetrievedChunks,
      AI_DEFAULTS.maxRetrievedChunksCap
    );
    const rows = await postgresDbRagRepository.listChunks(input.connectionId);
    if (rows.length === 0) return [];

    let queryEmbedding: number[] | null = null;
    try {
      queryEmbedding = await createEmbedding(input.query);
    } catch {
      queryEmbedding = null;
    }

    return recallAndRerankDbChunks({
      query: input.query,
      rows,
      queryEmbedding,
      finalLimit,
    });
  }
}
