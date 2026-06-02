export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function tokenizeForLexical(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9/{}\-_]+/g)
    .filter((t) => t.length > 1);
}

export function lexicalScore(query: string, document: string): number {
  const q = new Set(tokenizeForLexical(query));
  if (q.size === 0) return 0;
  const d = tokenizeForLexical(document);
  let hits = 0;
  for (const token of d) {
    if (q.has(token)) hits++;
  }
  return hits / q.size;
}

const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const;

/** Methods explicitly mentioned in the user question. */
export function extractHttpMethodsFromQuery(query: string): Set<string> {
  const upper = query.toUpperCase();
  const found = new Set<string>();
  for (const method of HTTP_METHODS) {
    const re = new RegExp(`\\b${method}\\b`);
    if (re.test(upper)) found.add(method);
  }
  return found;
}

/** Path-like fragments from the query (e.g. `/pets`, `/users/{id}`). */
export function extractPathFragmentsFromQuery(query: string): string[] {
  const matches = query.match(/\/[a-z0-9_{}\-/]+/gi) ?? [];
  return matches.map((p) => p.toLowerCase());
}

export type OpenApiChunkSignals = {
  title: string;
  content: string;
  endpointKey?: string;
  controller?: string;
};

/**
 * Overlap between query tokens and endpoint-oriented fields (method, path segments).
 */
export function endpointTokenOverlap(
  query: string,
  chunk: OpenApiChunkSignals
): number {
  const q = new Set(tokenizeForLexical(query));
  if (q.size === 0) return 0;
  const haystack = `${chunk.title} ${chunk.endpointKey ?? ""} ${chunk.content}`;
  const d = new Set(tokenizeForLexical(haystack));
  let hits = 0;
  for (const token of q) {
    if (d.has(token)) hits++;
  }
  return hits / q.size;
}

/** Boost when query mentions an exact HTTP method and/or path fragment present in the chunk. */
export function exactPathMethodBoost(
  query: string,
  chunk: OpenApiChunkSignals
): number {
  let boost = 0;
  const methods = extractHttpMethodsFromQuery(query);
  const titleUpper = chunk.title.toUpperCase();
  const keyUpper = (chunk.endpointKey ?? "").toUpperCase();

  if (methods.size > 0) {
    for (const method of methods) {
      if (titleUpper.startsWith(method) || keyUpper.startsWith(`${method}:`)) {
        boost += 0.35;
        break;
      }
    }
  }

  const paths = extractPathFragmentsFromQuery(query);
  const haystack = `${chunk.title} ${chunk.endpointKey ?? ""} ${chunk.content}`.toLowerCase();
  for (const path of paths) {
    if (path.length > 1 && haystack.includes(path)) {
      boost += 0.4;
      break;
    }
  }

  return Math.min(boost, 0.75);
}

/** Overlap between query terms and controller/tag labels. */
export function controllerTagOverlap(
  query: string,
  chunk: OpenApiChunkSignals
): number {
  const controller = chunk.controller?.trim();
  if (!controller) return 0;
  const qTokens = tokenizeForLexical(query);
  const cTokens = tokenizeForLexical(controller);
  if (qTokens.length === 0 || cTokens.length === 0) return 0;
  const cSet = new Set(cTokens);
  let hits = 0;
  for (const t of qTokens) {
    if (cSet.has(t)) hits++;
  }
  return hits / qTokens.length;
}

export type RecallScoreWeights = {
  semantic: number;
  lexical: number;
};

export type RerankScoreWeights = {
  recall: number;
  openapiFeatures: number;
  exactBoost: number;
};

/** Stage-1 recall score (semantic + lexical). */
export function computeRecallScore(input: {
  semantic: number;
  lexical: number;
  weights: RecallScoreWeights;
}): number {
  return (
    input.semantic * input.weights.semantic +
    input.lexical * input.weights.lexical
  );
}

/** Stage-2 rerank score combining recall + OpenAPI-specific features. */
export function computeRerankScore(input: {
  recallScore: number;
  query: string;
  chunk: OpenApiChunkSignals;
  weights: RerankScoreWeights;
}): number {
  const openapi =
    endpointTokenOverlap(input.query, input.chunk) * 0.5 +
    controllerTagOverlap(input.query, input.chunk) * 0.5;
  const exact = exactPathMethodBoost(input.query, input.chunk);
  return (
    input.recallScore * input.weights.recall +
    openapi * input.weights.openapiFeatures +
    exact * input.weights.exactBoost
  );
}
