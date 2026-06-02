import type { AIDocumentationAssistant } from "@/domain/ai/contracts";
import type { QAInput, QAOutput } from "@/domain/ai/types";
import { chunksToContextBlocks } from "@/domain/ai/pipeline/context-format";
import { OpenApiRetriever } from "@/infrastructure/ai/rag/openapi-retriever";
import { PostgresAiRepository } from "@/infrastructure/ai/repositories/postgres-ai-repository";
import { openAiDocumentationAssistant } from "@/infrastructure/ai/openai-responses-provider";

export type AnswerQuestionDeps = {
  assistant?: AIDocumentationAssistant;
  retriever?: OpenApiRetriever;
  repository?: PostgresAiRepository;
};

export async function answerOpenApiQuestion(
  input: QAInput,
  deps: AnswerQuestionDeps = {}
): Promise<QAOutput> {
  const retriever = deps.retriever ?? new OpenApiRetriever();
  const repository = deps.repository ?? new PostgresAiRepository();
  const assistant = deps.assistant ?? openAiDocumentationAssistant;

  const allowedEndpoints = await retriever.listAllowedEndpoints(input.specId);
  if (allowedEndpoints.length === 0) {
    throw new Error(
      "OpenAPI is not indexed for this spec. Call POST /api/ai/index-openapi first."
    );
  }

  const retrievedChunks = await retriever.retrieve({
    specId: input.specId,
    query: input.question,
  });
  const contextBlocks = chunksToContextBlocks(retrievedChunks);

  const result = await assistant.answer({
    ...input,
    allowedEndpoints,
    contextBlocks,
  });

  await repository.recordGeneration({
    specId: input.specId,
    kind: "question",
    status: "success",
    attempt: 1,
    inputJson: { question: input.question },
    outputJson: { answer: result.answer, citedEndpoints: result.citedEndpoints },
    validationJson: {},
    conversationId: input.conversationId,
  });

  return {
    ...result,
    retrievedChunks,
  };
}
