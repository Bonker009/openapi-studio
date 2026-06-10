import { AI_DEFAULTS } from "@/domain/ai/config";
import type {
  AiChatProvider,
  ChatModelSelection,
  ChatProviderCatalog,
} from "@/domain/ai/chat-provider";
import {
  getChatProviderCatalog,
  resolveChatSelection,
  validateChatSelection,
} from "@/infrastructure/ai/chat-provider-config";

export type AiModelTask = "embedding" | "rag_query" | "tool_loop" | "answer";

export type ResolvedTaskModel = {
  task: AiModelTask;
  provider: AiChatProvider;
  model: string;
};

function parseProviderEnv(
  key: string
): AiChatProvider | undefined {
  const v = process.env[key]?.trim().toLowerCase();
  if (v === "openai" || v === "groq") return v;
  return undefined;
}

function resolveTaskSelection(
  task: Exclude<AiModelTask, "embedding" | "answer">,
  providerEnv: string,
  modelEnv: string,
  catalog: ChatProviderCatalog
): ResolvedTaskModel | null {
  const provider = parseProviderEnv(providerEnv);
  const model = process.env[modelEnv]?.trim();
  if (!provider || !model) return null;
  if (!catalog.providers.some((p) => p.id === provider && p.configured)) {
    return null;
  }
  try {
    const sel = validateChatSelection({ provider, model });
    return { task, provider: sel.provider, model: sel.model };
  } catch {
    return null;
  }
}

export function resolveTaskModel(
  task: AiModelTask,
  userAnswer?: Partial<ChatModelSelection>
): ResolvedTaskModel {
  const catalog = getChatProviderCatalog();

  if (task === "embedding") {
    return {
      task,
      provider: "openai",
      model:
        process.env.OPENAI_EMBEDDING_MODEL?.trim() ||
        AI_DEFAULTS.embeddingModel,
    };
  }

  if (task === "answer") {
    const sel = resolveChatSelection(userAnswer);
    return { task, provider: sel.provider, model: sel.model };
  }

  if (task === "rag_query") {
    const resolved =
      resolveTaskSelection(
        "rag_query",
        "AI_RAG_QUERY_PROVIDER",
        "AI_RAG_QUERY_MODEL",
        catalog
      ) ?? fallbackTaskModel("rag_query", catalog);
    return resolved;
  }

  const resolved =
    resolveTaskSelection(
      "tool_loop",
      "AI_AGENT_TOOL_PROVIDER",
      "AI_AGENT_TOOL_MODEL",
      catalog
    ) ?? fallbackTaskModel("tool_loop", catalog);
  return resolved;
}

function fallbackTaskModel(
  task: "rag_query" | "tool_loop",
  catalog: ChatProviderCatalog
): ResolvedTaskModel {
  const entry = catalog.providers[0];
  if (!entry) {
    throw new Error("No chat provider configured for agent tasks.");
  }
  const model =
    task === "rag_query"
      ? entry.models.find((m) => m.includes("mini") || m.includes("8b")) ??
        entry.defaultModel
      : entry.defaultModel;
  return { task, provider: entry.id, model };
}

export type TaskModelsCatalog = {
  embedding: { provider: "openai"; model: string };
  ragQuery: { provider: AiChatProvider; model: string } | null;
  toolLoop: { provider: AiChatProvider; model: string };
};

export function getTaskModelsCatalog(): TaskModelsCatalog {
  let ragQuery: TaskModelsCatalog["ragQuery"] = null;
  try {
    const envRag = resolveTaskSelection(
      "rag_query",
      "AI_RAG_QUERY_PROVIDER",
      "AI_RAG_QUERY_MODEL",
      getChatProviderCatalog()
    );
    if (envRag) {
      ragQuery = { provider: envRag.provider, model: envRag.model };
    }
  } catch {
    ragQuery = null;
  }

  const toolLoop = resolveTaskModel("tool_loop");
  const embedding = resolveTaskModel("embedding");

  return {
    embedding: { provider: "openai", model: embedding.model },
    ragQuery,
    toolLoop: { provider: toolLoop.provider, model: toolLoop.model },
  };
}
