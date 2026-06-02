import { flowSchemaToInternalFlow } from "@/domain/ai/adapters/flow-contract-adapter";
import type { AIFlowGenerator, AIPlanner } from "@/domain/ai/contracts";
import type { GenerateFlowInput, GenerateFlowOutput } from "@/domain/ai/types";
import { buildEndpointCatalog } from "@/domain/ai/validation/endpoint-catalog";
import { analyzeIntent } from "@/domain/ai/pipeline/intent-analyzer";
import { runAutoFixLoop } from "@/domain/ai/pipeline/auto-fix-loop";
import { buildFlowCacheKey } from "@/domain/ai/pipeline/cache-key";
import {
  chunksToContextBlocks,
  resolveBaseUrl,
} from "@/domain/ai/pipeline/context-format";
import { parsePlanFromText } from "@/domain/ai/pipeline/plan-parser";
import { OpenApiRetriever } from "@/infrastructure/ai/rag/openapi-retriever";
import { PostgresAiRepository } from "@/infrastructure/ai/repositories/postgres-ai-repository";
import {
  openAiFlowGenerator,
  openAiPlanner,
} from "@/infrastructure/ai/openai-responses-provider";

export type GenerateFlowDeps = {
  planner?: AIPlanner;
  generator?: AIFlowGenerator;
  retriever?: OpenApiRetriever;
  repository?: PostgresAiRepository;
};

export async function generateFlowFromIntent(
  openapiJson: Record<string, unknown>,
  input: GenerateFlowInput,
  deps: GenerateFlowDeps = {}
): Promise<GenerateFlowOutput> {
  const planner = deps.planner ?? openAiPlanner;
  const generator = deps.generator ?? openAiFlowGenerator;
  const retriever = deps.retriever ?? new OpenApiRetriever();
  const repository = deps.repository ?? new PostgresAiRepository();

  const { normalizedIntent } = analyzeIntent(input.userIntent);
  const cacheKey = buildFlowCacheKey(input.specId, normalizedIntent);
  const cached = await repository.getFlowCache(input.specId, cacheKey);
  if (cached) {
    return {
      flowSchema: cached.flowSchema,
      plan: parsePlanFromText("", normalizedIntent),
      internalFlow: cached.internalFlow,
      retrievedChunks: [],
      attempts: 0,
      cached: true,
    };
  }

  const catalog = buildEndpointCatalog(openapiJson);
  const allowedEndpoints = catalog.map((c) => c.endpointKey);
  if (allowedEndpoints.length === 0) {
    throw new Error("OpenAPI spec has no indexable endpoints");
  }

  const retrievedChunks = await retriever.retrieve({
    specId: input.specId,
    query: normalizedIntent,
  });
  const contextBlocks = chunksToContextBlocks(retrievedChunks);

  const planText = await planner.createPlan({
    specId: input.specId,
    userIntent: normalizedIntent,
    allowedEndpoints,
    contextBlocks,
  });
  const plan = parsePlanFromText(planText, normalizedIntent);

  const initial = await generator.generateFlowJson({
    specId: input.specId,
    plan: planText,
    allowedEndpoints,
    contextBlocks,
  });

  const fixResult = await runAutoFixLoop({
    initial,
    catalog,
    maxAttempts: 3,
    fix: async ({ invalidFlow, errors }) =>
      generator.fixFlowJson({
        specId: input.specId,
        invalidFlow,
        validationErrors: errors,
        allowedEndpoints,
        contextBlocks,
      }),
  });

  const baseUrl = resolveBaseUrl(openapiJson, input.baseUrl);
  const internalFlow = flowSchemaToInternalFlow({
    specId: input.specId,
    name: `AI Flow: ${normalizedIntent.slice(0, 60)}`,
    baseUrl,
    flowSchema: fixResult.flow,
  });

  await repository.recordGeneration({
    specId: input.specId,
    kind: "flow",
    status: fixResult.valid ? "success" : "invalid",
    attempt: fixResult.attempts,
    inputJson: { intent: normalizedIntent, cacheKey },
    outputJson: { flowSchema: fixResult.flow },
    validationJson: { errors: fixResult.errors },
    conversationId: input.conversationId,
  });

  if (fixResult.valid) {
    await repository.setFlowCache({
      specId: input.specId,
      cacheKey,
      flowSchema: fixResult.flow,
      internalFlow,
      metadata: { intent: normalizedIntent },
    });
  }

  if (!fixResult.valid) {
    throw new Error(
      `Flow validation failed after ${fixResult.attempts} attempts: ${fixResult.errors.join("; ")}`
    );
  }

  return {
    flowSchema: fixResult.flow,
    plan,
    internalFlow,
    retrievedChunks,
    attempts: fixResult.attempts,
    cached: false,
  };
}
