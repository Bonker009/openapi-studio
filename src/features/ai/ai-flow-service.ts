import type {
  GenerateFlowInput,
  GenerateFlowOutput,
  IndexOpenApiInput,
  IndexOpenApiResult,
  QAInput,
  QAOutput,
} from "@/domain/ai/types";
import { generateFlowFromIntent } from "@/domain/ai/pipeline/generate-flow";
import { answerOpenApiQuestion } from "@/domain/ai/pipeline/answer-question";
import { specRepository } from "@/infrastructure/repositories";
import { PostgresAiRepository } from "@/infrastructure/ai/repositories/postgres-ai-repository";
import {
  getAiDisabledReason,
  isAiModuleEnabled as isAiEnabled,
} from "@/lib/ai/module-status";

export function isAiModuleEnabled(): boolean {
  return isAiEnabled();
}

export class AiFlowService {
  constructor(private readonly aiRepo = new PostgresAiRepository()) {}

  async indexOpenApi(input: IndexOpenApiInput): Promise<IndexOpenApiResult> {
    const exists = await specRepository.exists(input.specId);
    if (!exists) {
      throw new Error(`Spec not found: ${input.specId}`);
    }
    const openapiJson = (await specRepository.findById(input.specId)) as
      | Record<string, unknown>
      | null;
    if (!openapiJson) {
      throw new Error(`Spec not found: ${input.specId}`);
    }
    const stats = await this.aiRepo.indexOpenApi(input.specId, openapiJson);
    return {
      specId: input.specId,
      chunkCount: stats.chunkCount,
      endpointCount: stats.endpointCount,
      indexedAt: Date.now(),
    };
  }

  async generateFlow(input: GenerateFlowInput): Promise<GenerateFlowOutput> {
    if (!isAiModuleEnabled()) {
      throw new Error(getAiDisabledReason() ?? "AI module is disabled");
    }
    const openapiJson = (await specRepository.findById(input.specId)) as
      | Record<string, unknown>
      | null;
    if (!openapiJson) {
      throw new Error(`Spec not found: ${input.specId}`);
    }
    return generateFlowFromIntent(openapiJson, input, {
      repository: this.aiRepo,
    });
  }

  async answerQuestion(input: QAInput): Promise<QAOutput> {
    if (!isAiModuleEnabled()) {
      throw new Error(getAiDisabledReason() ?? "AI module is disabled");
    }
    const exists = await specRepository.exists(input.specId);
    if (!exists) {
      throw new Error(`Spec not found: ${input.specId}`);
    }
    return answerOpenApiQuestion(input, { repository: this.aiRepo });
  }
}

export const aiFlowService = new AiFlowService();
