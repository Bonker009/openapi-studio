import { dbAgentEnabled } from "@/domain/db/config";
import type { DbAgentInput, DbSuggestPayloadInput } from "@/domain/db/types";
import { runDbAgentGraph } from "@/infrastructure/ai/langgraph/db-agent-graph";
import { DbRetriever } from "@/infrastructure/ai/rag/db-retriever";
import { OpenApiRetriever } from "@/infrastructure/ai/rag/openapi-retriever";
import { executeReadOnlyQuery } from "@/infrastructure/db/postgres-user-client";
import { PostgresAiRepository } from "@/infrastructure/ai/repositories/postgres-ai-repository";
import { postgresDbConnectionRepository } from "@/infrastructure/repositories/postgres-db-connection-repository";
import { responsesText } from "@/infrastructure/ai/openai-client";
import { chunksToContextBlocks } from "@/domain/ai/pipeline/context-format";

function buildHistoryAwareQuery(
  question: string,
  history?: { role: string; content: string }[]
): string {
  const prior = (history ?? [])
    .slice(-6)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");
  return prior ? `${prior}\nCurrent: ${question}` : question;
}

const aiRepo = new PostgresAiRepository();

export class DbAgentService {
  async ensureEnabled() {
    if (!dbAgentEnabled()) {
      throw new Error("Database agent is disabled (DB_AGENT_ENABLED=false)");
    }
  }

  async getOrCreateConversation(
    specId: string,
    conversationId?: string,
    connectionId?: string
  ): Promise<string> {
    if (conversationId) return conversationId;
    const id = await aiRepo.createConversation({
      specId,
      kind: "db_question",
      title: connectionId ? `Database Q&A (${connectionId.slice(0, 8)})` : "Database Q&A",
    });
    return id;
  }

  async ask(input: DbAgentInput): Promise<{
    answer: string;
    conversationId: string;
  }> {
    await this.ensureEnabled();
    const row = await postgresDbConnectionRepository.findForSpec(
      input.specId,
      input.connectionId
    );
    if (!row) throw new Error("Connection not found");
    if (row.status !== "active") {
      throw new Error("Connection is not active. Test the connection first.");
    }

    const conversationId = await this.getOrCreateConversation(
      input.specId,
      input.conversationId,
      input.connectionId
    );

    const retrievalQuery = buildHistoryAwareQuery(
      input.question,
      input.history
    );

    await aiRepo.appendMessage({
      conversationId,
      role: "user",
      content: input.question,
    });

    const { answer } = await runDbAgentGraph({
      specId: input.specId,
      connectionRow: row,
      question: input.question,
      retrievalQuery,
      threadId: conversationId,
      chatProvider: input.chatProvider,
      chatModel: input.chatModel,
    });

    await aiRepo.appendMessage({
      conversationId,
      role: "assistant",
      content: answer,
    });

    await aiRepo.recordGeneration({
      specId: input.specId,
      kind: "db_question",
      status: "success",
      attempt: 1,
      conversationId,
      inputJson: { question: input.question, connectionId: input.connectionId },
      outputJson: { answer },
      validationJson: {},
    });

    return { answer, conversationId };
  }

  async askStream(
    input: DbAgentInput,
    handlers: {
      onDelta: (text: string) => void;
      onDone: (result: { answer: string; conversationId: string }) => void;
      onError: (message: string) => void;
    }
  ): Promise<void> {
    try {
      const result = await this.ask(input);
      handlers.onDelta(result.answer);
      handlers.onDone(result);
    } catch (e) {
      handlers.onError(e instanceof Error ? e.message : String(e));
    }
  }

  async suggestPayload(input: DbSuggestPayloadInput) {
    await this.ensureEnabled();
    const row = await postgresDbConnectionRepository.findForSpec(
      input.specId,
      input.connectionId
    );
    if (!row) throw new Error("Connection not found");

    const dbRetriever = new DbRetriever();
    const openApiRetriever = new OpenApiRetriever();
    const query = `payload parameters ${input.paramNames.join(" ")} ${input.endpointKey}`;
    const [dbChunks, apiChunks] = await Promise.all([
      dbRetriever.retrieve({ connectionId: input.connectionId, query, limit: 5 }),
      openApiRetriever.retrieve({ specId: input.specId, query, limit: 3 }),
    ]);
    const context = chunksToContextBlocks([...dbChunks, ...apiChunks]).join(
      "\n\n"
    );

    const suggestions: Record<string, string> = {};
    const sources: Record<string, { table: string; confidence: number }> = {};

    for (const param of input.paramNames.slice(0, 8)) {
      const tableGuess = dbChunks[0]?.endpointKey ?? dbChunks[0]?.title?.replace("Table ", "");
      if (!tableGuess) continue;
      try {
        const q = `SELECT "${param}" FROM "${tableGuess}" WHERE "${param}" IS NOT NULL LIMIT 5`;
        const res = await executeReadOnlyQuery(row, q);
        const val = res.rows[0]?.[param];
        if (val != null) {
          suggestions[param] = String(val);
          sources[param] = { table: tableGuess, confidence: 0.7 };
        }
      } catch {
        /* skip param */
      }
    }

    if (Object.keys(suggestions).length === 0 && context) {
      const prompt = `Given API endpoint ${input.endpointKey} and DB schema context, suggest JSON field values for parameters: ${input.paramNames.join(", ")}. Return compact JSON object only.\n\n${context}`;
      const raw = await responsesText({
        instructions: "Return only a JSON object mapping parameter names to suggested string values.",
        prompt,
      });
      try {
        const parsed = JSON.parse(raw.replace(/^```json?\s*|\s*```$/g, "")) as Record<
          string,
          string
        >;
        Object.assign(suggestions, parsed);
      } catch {
        /* ignore parse */
      }
    }

    return { suggestions, sources };
  }
}

export const dbAgentService = new DbAgentService();
