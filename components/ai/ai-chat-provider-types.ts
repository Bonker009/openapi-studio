import type {
  AiChatProvider,
  ChatProviderCatalog,
} from "@/domain/ai/chat-provider";

export type { AiChatProvider, ChatProviderCatalog };

export type AiChatSettings = {
  provider: AiChatProvider;
  model: string;
};

export type TaskModelsCatalog = {
  embedding: { provider: "openai"; model: string };
  ragQuery: { provider: AiChatProvider; model: string } | null;
  toolLoop: { provider: AiChatProvider; model: string };
};

export type AiConfigApiResponse = ChatProviderCatalog & {
  enabled: boolean;
  disabledReason: string | null;
  taskModels?: TaskModelsCatalog | null;
};
