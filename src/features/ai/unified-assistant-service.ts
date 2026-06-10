import { generateText, stepCountIs, streamText } from "ai";
import type { QAHistoryMessage } from "@/domain/ai/types";
import { unifiedAgentMaxSteps } from "@/domain/db/config";
import { resolveTaskModel } from "@/domain/ai/model-task-routing";
import { PROMPT_VERSION } from "@/domain/ai/prompts/prompt-sections";
import { buildAnswerSynthesisPrompt } from "@/domain/ai/prompts/answer-synthesis-prompt";
import { buildRagQueryRewritePrompt } from "@/domain/ai/prompts/rag-query-rewrite-prompt";
import { buildToolLoopSystemPrompt } from "@/domain/ai/prompts/tool-loop-system-prompt";
import { buildUnifiedAssistantSystemPrompt } from "@/domain/ai/prompts/unified-assistant-system";
import type { ToolResultBlock } from "@/domain/ai/prompts/prompt-sections";
import { extractCitedEndpointsFromAnswer } from "@/domain/ai/validation/extract-citations";
import { resolveChatModel } from "@/infrastructure/ai/ai-sdk-provider";
import {
  createUnifiedAssistantTools,
  toolNameToStatusPhase,
  type UnifiedToolName,
} from "@/infrastructure/ai/unified-assistant-tools";
import { OpenApiRetriever } from "@/infrastructure/ai/rag/openapi-retriever";
import { postgresDbConnectionRepository } from "@/infrastructure/repositories/postgres-db-connection-repository";
import { postgresDbRagRepository } from "@/infrastructure/repositories/postgres-db-rag-repository";
import { getTaskModelsCatalog } from "@/domain/ai/model-task-routing";
import type { ChatModelSelection } from "@/domain/ai/chat-provider";

export type UnifiedChatInput = {
  specId: string;
  question: string;
  history?: QAHistoryMessage[];
  connectionId?: string;
  chatProvider?: ChatModelSelection["provider"];
  chatModel?: string;
  signal?: AbortSignal;
};

export type UnifiedStreamPhase =
  | "thinking"
  | "planning-search"
  | "searching-api"
  | "searching-db"
  | "running-sql"
  | "generating";

export type UnifiedChatHandlers = {
  onStatus?: (phase: UnifiedStreamPhase) => void;
  onDelta: (text: string) => void;
  onDone: (result: {
    answer: string;
    citedEndpoints: string[];
    toolsUsed: string[];
    connectionId?: string;
    modelsUsed: {
      ragQuery?: { provider: string; model: string };
      toolLoop: { provider: string; model: string };
      answer: { provider: string; model: string };
    };
    promptVersion: string;
  }) => void;
  onError: (message: string) => void;
};

function toModelMessages(history: QAHistoryMessage[] | undefined) {
  return (history ?? []).slice(-12).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content.slice(0, 1500),
  }));
}

function ragQueryRewriteEnabled(): boolean {
  return Boolean(
    process.env.AI_RAG_QUERY_PROVIDER?.trim() &&
      process.env.AI_RAG_QUERY_MODEL?.trim()
  );
}

async function rewriteRetrievalQuery(
  input: UnifiedChatInput,
  handlers: UnifiedChatHandlers
): Promise<string> {
  if (!ragQueryRewriteEnabled()) return input.question;

  handlers.onStatus?.("planning-search");
  const task = resolveTaskModel("rag_query");
  const { model } = resolveChatModel({
    provider: task.provider,
    model: task.model,
  });

  const result = await generateText({
    model,
    temperature: 0.1,
    prompt: buildRagQueryRewritePrompt({
      question: input.question,
      history: input.history,
    }),
    abortSignal: input.signal,
  });

  const line = result.text.trim().split("\n")[0]?.trim();
  return line || input.question;
}

export function collectToolResults(
  steps: Array<{
    toolResults?: Array<{
      toolName: string;
      output?: unknown;
      result?: unknown;
    }>;
  }>
): { blocks: ToolResultBlock[]; names: UnifiedToolName[] } {
  const blocks: ToolResultBlock[] = [];
  const names = new Set<UnifiedToolName>();

  for (const step of steps) {
    for (const tr of step.toolResults ?? []) {
      const name = tr.toolName as UnifiedToolName;
      names.add(name);
      const raw = tr.output ?? tr.result;
      const output =
        typeof raw === "string"
          ? raw
          : JSON.stringify(raw ?? "");
      let truncated = false;
      try {
        const parsed = JSON.parse(output) as { truncated?: boolean };
        truncated = Boolean(parsed.truncated);
      } catch {
        // ignore
      }
      blocks.push({ toolName: name, output, truncated });
    }
  }

  return { blocks, names: [...names] };
}

export async function streamUnifiedChat(
  input: UnifiedChatInput,
  handlers: UnifiedChatHandlers
): Promise<void> {
  const retriever = new OpenApiRetriever();

  try {
    handlers.onStatus?.("thinking");

    const allowedEndpoints = await retriever.listAllowedEndpoints(input.specId);
    if (allowedEndpoints.length === 0) {
      handlers.onError(
        "OpenAPI is not indexed for this spec. Open the Index tab and index this spec first."
      );
      return;
    }

    let connectionRow:
      | Awaited<ReturnType<typeof postgresDbConnectionRepository.findForSpec>>
      | undefined;
    let dbIndexed = false;
    let dbLabel: string | undefined;

    if (input.connectionId) {
      connectionRow = await postgresDbConnectionRepository.findForSpec(
        input.specId,
        input.connectionId
      );
      if (!connectionRow || connectionRow.status !== "active") {
        handlers.onError("Database connection is not active.");
        return;
      }
      dbLabel = connectionRow.label;
      const chunks = await postgresDbRagRepository.listChunks(
        input.connectionId
      );
      dbIndexed = chunks.length > 0;
    }

    const retrievalQuery = await rewriteRetrievalQuery(input, handlers);

    const toolTask = resolveTaskModel("tool_loop");
    const { model: toolModel } = resolveChatModel({
      provider: toolTask.provider,
      model: toolTask.model,
    });

    const tools = createUnifiedAssistantTools({
      specId: input.specId,
      retrievalQuery,
      connectionId: input.connectionId,
      connectionRow: connectionRow ?? undefined,
    });

    const toolLoopResult = await generateText({
      model: toolModel,
      system: buildToolLoopSystemPrompt({
        dbConnected: Boolean(connectionRow),
        dbIndexed,
        dbLabel,
      }),
      messages: [
        ...toModelMessages(input.history),
        { role: "user", content: input.question },
      ],
      tools,
      stopWhen: stepCountIs(unifiedAgentMaxSteps()),
      abortSignal: input.signal,
      onStepFinish: ({ toolCalls }) => {
        for (const tc of toolCalls ?? []) {
          handlers.onStatus?.(toolNameToStatusPhase(tc.toolName));
        }
      },
    });

    const { blocks: toolBlocks, names: toolsUsed } = collectToolResults(
      toolLoopResult.steps ?? []
    );

    handlers.onStatus?.("generating");

    const answerTask = resolveTaskModel("answer", {
      provider: input.chatProvider,
      model: input.chatModel ?? "",
    });
    const { model: answerModel } = resolveChatModel({
      provider: answerTask.provider,
      model: answerTask.model,
    });

    const synthesisPrompt = buildAnswerSynthesisPrompt({
      question: input.question,
      allowedEndpoints,
      history: input.history,
      toolResults: toolBlocks,
    });

    const stream = streamText({
      model: answerModel,
      system: buildUnifiedAssistantSystemPrompt(),
      prompt: synthesisPrompt,
      abortSignal: input.signal,
    });

    let answer = "";
    for await (const delta of stream.textStream) {
      if (!delta) continue;
      answer += delta;
      handlers.onDelta(delta);
    }

    answer = answer.trim();
    const citedEndpoints = extractCitedEndpointsFromAnswer(
      answer,
      allowedEndpoints
    );

    const ragTask = ragQueryRewriteEnabled()
      ? resolveTaskModel("rag_query")
      : null;

    handlers.onDone({
      answer,
      citedEndpoints,
      toolsUsed,
      connectionId: input.connectionId,
      modelsUsed: {
        ragQuery: ragTask
          ? { provider: ragTask.provider, model: ragTask.model }
          : undefined,
        toolLoop: { provider: toolTask.provider, model: toolTask.model },
        answer: { provider: answerTask.provider, model: answerTask.model },
      },
      promptVersion: PROMPT_VERSION,
    });
  } catch (e) {
    if (input.signal?.aborted) {
      handlers.onError("Generation stopped");
      return;
    }
    handlers.onError(e instanceof Error ? e.message : String(e));
  }
}

export { getTaskModelsCatalog };
