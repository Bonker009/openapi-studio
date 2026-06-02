/** Chat completion provider (not used for embeddings). */
export type AiChatProvider = "openai" | "groq";

export type ChatModelSelection = {
  provider: AiChatProvider;
  model: string;
};

export type ChatProviderCatalogEntry = {
  id: AiChatProvider;
  label: string;
  configured: boolean;
  defaultModel: string;
  models: string[];
};

export type ChatProviderCatalog = {
  providers: ChatProviderCatalogEntry[];
  defaultProvider: AiChatProvider | null;
  defaultModel: string | null;
  embeddingRequiresOpenAi: boolean;
};
