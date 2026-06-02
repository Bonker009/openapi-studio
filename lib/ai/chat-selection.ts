import type {
  AiChatProvider,
  ChatModelSelection,
} from "@/domain/ai/chat-provider";
import {
  resolveChatSelection,
  validateChatSelection,
} from "@/infrastructure/ai/chat-provider-config";

export function parseChatSelectionFromBody(body: {
  chatProvider?: string;
  chatModel?: string;
  provider?: string;
  model?: string;
}): ChatModelSelection | undefined {
  const providerRaw = (body.chatProvider ?? body.provider)?.trim().toLowerCase();
  const model = (body.chatModel ?? body.model)?.trim();

  if (!providerRaw && !model) return undefined;

  if (
    providerRaw &&
    providerRaw !== "openai" &&
    providerRaw !== "groq"
  ) {
    throw new Error('chatProvider must be "openai" or "groq"');
  }

  return resolveChatSelection({
    provider: providerRaw ? (providerRaw as AiChatProvider) : undefined,
    model: model || undefined,
  });
}

export { validateChatSelection, resolveChatSelection };
export type { ChatModelSelection } from "@/domain/ai/chat-provider";
