import type {
  AiChatProvider,
  ChatProviderCatalog,
} from "@/domain/ai/chat-provider";

export type { AiChatProvider, ChatProviderCatalog };

export type AiChatSettings = {
  provider: AiChatProvider;
  model: string;
};

export type AiConfigApiResponse = ChatProviderCatalog & {
  enabled: boolean;
  disabledReason: string | null;
};
