export const AI_DEFAULTS = {
  temperature: 0.2,
  maxRetries: 3,
  maxRetrievedChunks: 16,
  maxRetrievedChunksCap: 20,
  maxOutputTokens: 1500,
  embeddingModel: "text-embedding-3-small",
  chatModel: "gpt-4o-mini",
  maxFixAttempts: 3,
  /** Stage-1: max chunks kept before reranking. */
  ragRecallPoolSize: 40,
  /** Stage-1 minimum recall score to enter the pool. */
  ragRecallMinScore: 0.02,
  /** Stage-2 minimum rerank score for final context. */
  ragFinalMinScore: 0.04,
  ragRecallWeights: {
    semantic: 0.6,
    lexical: 0.4,
  },
  ragRerankWeights: {
    recall: 0.55,
    openapiFeatures: 0.3,
    exactBoost: 0.15,
  },
} as const;
