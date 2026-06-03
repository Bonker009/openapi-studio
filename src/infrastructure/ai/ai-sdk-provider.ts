import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import { AI_DEFAULTS } from "@/domain/ai/config";
import type { ChatModelSelection } from "@/domain/ai/chat-provider";
import {
  resolveChatRuntimeConfig,
  type ResolvedChatRuntimeConfig,
} from "@/infrastructure/ai/chat-provider-config";

export type ChatRequestOptions = Partial<ChatModelSelection>;

function createProviderModel(cfg: ResolvedChatRuntimeConfig) {
  if (cfg.provider === "groq") {
    const groq = createGroq({
      apiKey: cfg.apiKey,
      baseURL: cfg.baseUrl,
    });
    return groq(cfg.model);
  }

  const openai = createOpenAI({
    apiKey: cfg.apiKey,
    baseURL: cfg.baseUrl,
  });
  return openai.responses(cfg.model);
}

export function resolveChatModel(input?: ChatRequestOptions) {
  const cfg = resolveChatRuntimeConfig(input);
  const model = createProviderModel(cfg);
  return { model, config: cfg };
}

export function resolveEmbeddingModel() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not configured (required for embeddings/indexing)"
    );
  }

  const openai = createOpenAI({
    apiKey,
    baseURL:
      process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1",
  });
  const model =
    process.env.OPENAI_EMBEDDING_MODEL?.trim() || AI_DEFAULTS.embeddingModel;

  return openai.textEmbeddingModel(model);
}
