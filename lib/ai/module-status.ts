/** Server-side AI availability (reads process.env at request time). */

import {
  isAnyChatProviderConfigured,
  isOpenAiChatConfigured,
} from "@/infrastructure/ai/chat-provider-config";

export function getAiDisabledReason(): string | null {
  if (process.env.ENABLE_AI === "false") {
    return "ENABLE_AI is set to false on the server.";
  }
  if (!isAnyChatProviderConfigured()) {
    return (
      "No chat provider is configured. Set OPENAI_API_KEY and/or GROQ_API_KEY " +
      "on the server. If you use Docker, add env_file: .env to the web service and restart."
    );
  }
  return null;
}

export function isAiModuleEnabled(): boolean {
  return getAiDisabledReason() === null;
}

export function getEmbeddingDisabledReason(): string | null {
  if (!isOpenAiChatConfigured()) {
    return (
      "OPENAI_API_KEY is required for OpenAPI indexing (embeddings). " +
      "Groq can be used for chat, but indexing still needs OpenAI."
    );
  }
  return null;
}
