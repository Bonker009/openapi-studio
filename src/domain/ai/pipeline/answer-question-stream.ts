import type { QAInput, QAHistoryMessage } from "@/domain/ai/types";
import { chunksToContextBlocks } from "@/domain/ai/pipeline/context-format";
import { buildDocumentationPrompt } from "@/domain/ai/prompts/documentation-prompt-builder";
import { extractCitedEndpointsFromAnswer } from "@/domain/ai/validation/extract-citations";
import { responsesTextStream } from "@/infrastructure/ai/openai-client";
import { OpenApiRetriever } from "@/infrastructure/ai/rag/openapi-retriever";
import { PostgresAiRepository } from "@/infrastructure/ai/repositories/postgres-ai-repository";

const DOC_STREAM_INSTRUCTIONS =
  "You are an OpenAPI documentation assistant. Ground answers in the provided " +
  "endpoint list and ranked evidence. Use clear markdown when helpful. Cite endpoints " +
  "as METHOD /path when relevant. When evidence is partial, give a best-supported answer " +
  "with confidence and brief alternatives instead of refusing outright.";

export type StreamAnswerStatusPhase = "retrieving" | "generating";

export type StreamAnswerHandlers = {
  onDelta: (text: string) => void;
  onDone: (result: { answer: string; citedEndpoints: string[] }) => void;
  onError: (message: string) => void;
  onStatus?: (phase: StreamAnswerStatusPhase) => void;
};

export type StreamAnswerInput = QAInput & {
  signal?: AbortSignal;
};

function buildHistoryAwareQuery(
  question: string,
  history: QAHistoryMessage[] | undefined
): string {
  const prior = (history ?? [])
    .slice(-6)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");
  return prior ? `${prior}\nCurrent user question: ${question}` : question;
}

function toModelHistory(history: QAHistoryMessage[] | undefined) {
  return (history ?? []).slice(-12).map((m) => ({
    role: m.role,
    content: m.content.slice(0, 1500),
  }));
}

export async function streamOpenApiQuestion(
  input: StreamAnswerInput,
  handlers: StreamAnswerHandlers,
  deps: { retriever?: OpenApiRetriever; repository?: PostgresAiRepository } = {}
): Promise<void> {
  const retriever = deps.retriever ?? new OpenApiRetriever();
  const repository = deps.repository ?? new PostgresAiRepository();

  try {
    const allowedEndpoints = await retriever.listAllowedEndpoints(input.specId);
    if (allowedEndpoints.length === 0) {
      handlers.onError(
        "OpenAPI is not indexed for this spec. Open the Index tab and index this spec first."
      );
      return;
    }

    handlers.onStatus?.("retrieving");
    const retrievalQuery = buildHistoryAwareQuery(input.question, input.history);
    const retrievedChunks = await retriever.retrieve({
      specId: input.specId,
      query: retrievalQuery,
    });
    const contextBlocks = chunksToContextBlocks(retrievedChunks);

    const prompt = buildDocumentationPrompt({
      question: input.question,
      allowedEndpoints,
      contextBlocks,
      history: input.history,
    });

    handlers.onStatus?.("generating");
    const answer = await responsesTextStream(
      {
        instructions: DOC_STREAM_INSTRUCTIONS,
        prompt,
        signal: input.signal,
        chat: {
          provider: input.chatProvider,
          model: input.chatModel,
        },
        messages: toModelHistory(input.history),
      },
      { onDelta: handlers.onDelta }
    );

    const citedEndpoints = extractCitedEndpointsFromAnswer(
      answer,
      allowedEndpoints
    );

    await repository.recordGeneration({
      specId: input.specId,
      kind: "question",
      status: "success",
      attempt: 1,
      inputJson: {
        question: input.question,
        stream: true,
        history: input.history ?? [],
      },
      outputJson: { answer, citedEndpoints },
      validationJson: {},
      conversationId: input.conversationId,
    });

    handlers.onDone({ answer, citedEndpoints });
  } catch (error) {
    if (input.signal?.aborted) {
      handlers.onError("Generation stopped");
      return;
    }
    const message =
      error instanceof Error ? error.message : "Failed to stream answer";
    handlers.onError(message);
  }
}
