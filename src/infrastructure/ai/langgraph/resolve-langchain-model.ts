import { ChatOpenAI } from "@langchain/openai";
import { ChatGroq } from "@langchain/groq";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { resolveChatRuntimeConfig } from "@/infrastructure/ai/chat-provider-config";
import type { AiChatProvider } from "@/domain/ai/chat-provider";

export function resolveLangChainChatModel(input?: {
  provider?: AiChatProvider;
  model?: string;
  temperature?: number;
}): BaseChatModel {
  const cfg = resolveChatRuntimeConfig({
    provider: input?.provider,
    model: input?.model,
  });
  const temperature = input?.temperature ?? cfg.temperature;

  if (cfg.provider === "groq") {
    return new ChatGroq({
      apiKey: cfg.apiKey,
      model: cfg.model,
      temperature,
      baseUrl: cfg.groqSdkBaseUrl ?? "https://api.groq.com",
    });
  }

  return new ChatOpenAI({
    apiKey: cfg.apiKey,
    model: cfg.model,
    temperature,
    configuration: { baseURL: cfg.baseUrl },
  });
}
