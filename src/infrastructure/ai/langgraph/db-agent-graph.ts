import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getDbAgentCheckpointer } from "@/infrastructure/ai/langgraph/checkpointer";
import {
  createDbAgentTools,
  DB_AGENT_SYSTEM_PROMPT,
} from "@/infrastructure/ai/langgraph/db-agent-tools";
import { resolveLangChainChatModel } from "@/infrastructure/ai/langgraph/resolve-langchain-model";
import type { UserDbConnectionRow } from "@/infrastructure/db/postgres-user-client";
import { dbAgentMaxSqlRetries } from "@/domain/db/config";
import type { AiChatProvider } from "@/domain/ai/chat-provider";

export async function runDbAgentGraph(input: {
  specId: string;
  connectionRow: UserDbConnectionRow;
  question: string;
  retrievalQuery: string;
  threadId: string;
  chatProvider?: AiChatProvider;
  chatModel?: string;
}): Promise<{ answer: string; messages: unknown[] }> {
  const checkpointer = await getDbAgentCheckpointer();
  const llm = resolveLangChainChatModel({
    provider: input.chatProvider,
    model: input.chatModel,
    temperature: 0.2,
  });

  const tools = createDbAgentTools({
    specId: input.specId,
    connectionRow: input.connectionRow,
    retrievalQuery: input.retrievalQuery,
  });

  const agent = createReactAgent({
    llm,
    tools,
    checkpointSaver: checkpointer,
    messageModifier: new SystemMessage(DB_AGENT_SYSTEM_PROMPT),
  });

  const config = {
    configurable: { thread_id: input.threadId },
    recursionLimit: 12 + dbAgentMaxSqlRetries() * 4,
  };

  const result = await agent.invoke(
    {
      messages: [new HumanMessage(input.question)],
    },
    config
  );

  const messages = (result as { messages?: { content: unknown }[] }).messages ?? [];
  const last = messages[messages.length - 1];
  const content = last?.content;
  const answer =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content
            .map((p) =>
              typeof p === "object" && p && "text" in p
                ? String((p as { text: string }).text)
                : ""
            )
            .join("")
        : String(content ?? "");

  return { answer: answer.trim(), messages };
}
