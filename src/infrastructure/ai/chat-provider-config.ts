import { AI_DEFAULTS } from "@/domain/ai/config";
import type {
  AiChatProvider,
  ChatModelSelection,
  ChatProviderCatalog,
  ChatProviderCatalogEntry,
} from "@/domain/ai/chat-provider";

function parseModelList(envValue: string | undefined, fallback: string[]): string[] {
  if (!envValue?.trim()) return fallback;
  const list = envValue
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length > 0 ? list : fallback;
}

function buildProviderEntry(input: {
  id: AiChatProvider;
  label: string;
  apiKey: string | undefined;
  defaultModel: string;
  modelsEnv: string | undefined;
}): ChatProviderCatalogEntry {
  const configured = Boolean(input.apiKey?.trim());
  const defaultModel = input.defaultModel.trim();
  const models = parseModelList(input.modelsEnv, [defaultModel]);
  const uniqueModels = [...new Set([defaultModel, ...models])];
  return {
    id: input.id,
    label: input.label,
    configured,
    defaultModel,
    models: uniqueModels,
  };
}

export function getChatProviderCatalog(): ChatProviderCatalog {
  const openai = buildProviderEntry({
    id: "openai",
    label: "OpenAI",
    apiKey: process.env.OPENAI_API_KEY,
    defaultModel:
      process.env.OPENAI_CHAT_MODEL?.trim() || AI_DEFAULTS.chatModel,
    modelsEnv: process.env.OPENAI_CHAT_MODELS,
  });
  const groq = buildProviderEntry({
    id: "groq",
    label: "Groq",
    apiKey: process.env.GROQ_API_KEY,
    defaultModel:
      process.env.GROQ_CHAT_MODEL?.trim() || AI_DEFAULTS.groqChatModel,
    modelsEnv: process.env.GROQ_CHAT_MODELS,
  });

  const providers = [openai, groq].filter((p) => p.configured);
  const preferred =
    (process.env.AI_CHAT_DEFAULT_PROVIDER?.trim().toLowerCase() as
      | AiChatProvider
      | undefined) ?? null;
  const defaultProvider =
    (preferred && providers.some((p) => p.id === preferred)
      ? preferred
      : providers[0]?.id) ?? null;
  const defaultEntry = providers.find((p) => p.id === defaultProvider);

  return {
    providers,
    defaultProvider,
    defaultModel: defaultEntry?.defaultModel ?? null,
    embeddingRequiresOpenAi: true,
  };
}

export function isGroqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

export function isOpenAiChatConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function isAnyChatProviderConfigured(): boolean {
  return isOpenAiChatConfigured() || isGroqConfigured();
}

export function validateChatSelection(
  selection: ChatModelSelection
): ChatModelSelection {
  const catalog = getChatProviderCatalog();
  const entry = catalog.providers.find((p) => p.id === selection.provider);
  if (!entry) {
    throw new Error(
      `Chat provider "${selection.provider}" is not configured. Set the provider API key on the server.`
    );
  }
  const model = selection.model.trim();
  if (!model) {
    throw new Error("A chat model is required.");
  }
  if (!entry.models.includes(model)) {
    throw new Error(
      `Model "${model}" is not available for ${entry.label}. Choose one of: ${entry.models.join(", ")}`
    );
  }
  return { provider: selection.provider, model };
}

export function resolveChatSelection(
  partial?: Partial<ChatModelSelection>
): ChatModelSelection {
  const catalog = getChatProviderCatalog();
  if (catalog.providers.length === 0) {
    throw new Error(
      "No chat provider configured. Set OPENAI_API_KEY and/or GROQ_API_KEY."
    );
  }
  const provider =
    partial?.provider && catalog.providers.some((p) => p.id === partial.provider)
      ? partial.provider
      : catalog.defaultProvider!;
  const entry = catalog.providers.find((p) => p.id === provider)!;
  const model =
    partial?.model?.trim() && entry.models.includes(partial.model.trim())
      ? partial.model.trim()
      : entry.defaultModel;
  return validateChatSelection({ provider, model });
}

export type ResolvedChatRuntimeConfig = {
  provider: AiChatProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  /** OpenAI Responses API; Groq uses Chat Completions. */
  useResponsesApi: boolean;
};

export function resolveChatRuntimeConfig(
  partial?: Partial<ChatModelSelection>
): ResolvedChatRuntimeConfig {
  const { provider, model } = resolveChatSelection(partial);
  const temperature = AI_DEFAULTS.temperature;

  if (provider === "groq") {
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("GROQ_API_KEY is not configured");
    }
    return {
      provider,
      apiKey,
      baseUrl:
        process.env.GROQ_BASE_URL?.trim() ||
        "https://api.groq.com/openai/v1",
      model,
      temperature,
      useResponsesApi: false,
    };
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return {
    provider,
    apiKey,
    baseUrl:
      process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1",
    model,
    temperature,
    useResponsesApi: true,
  };
}
