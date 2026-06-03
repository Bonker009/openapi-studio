import { embed, generateObject, generateText, jsonSchema, streamText } from "ai";
import { AI_DEFAULTS } from "@/domain/ai/config";
import {
  isAnyChatProviderConfigured,
  isOpenAiChatConfigured,
} from "@/infrastructure/ai/chat-provider-config";
import {
  resolveChatModel,
  resolveEmbeddingModel,
  type ChatRequestOptions,
} from "@/infrastructure/ai/ai-sdk-provider";
import { redactText } from "@/infrastructure/ai/security/redaction";

export type { ChatRequestOptions };

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function sanitizeMessages(messages: ChatMessage[] | undefined): ChatMessage[] | undefined {
  if (!messages?.length) return undefined;
  return messages
    .filter((m) => typeof m.content === "string" && m.content.trim())
    .map((m) => ({
      role: m.role,
      content: redactText(m.content),
    }));
}

export async function createEmbedding(text: string): Promise<number[]> {
  const embeddingModel = resolveEmbeddingModel();
  const result = await embed({
    model: embeddingModel,
    value: redactText(text).slice(0, 8000),
  });
  if (!result.embedding?.length) throw new Error("Empty embedding response");
  return result.embedding;
}

export async function responsesJson<T>(input: {
  instructions: string;
  input: string;
  schemaName: string;
  schema: Record<string, unknown>;
  chat?: ChatRequestOptions;
}): Promise<T> {
  const { model, config } = resolveChatModel(input.chat);
  const result = await generateObject({
    model,
    temperature: config.temperature,
    maxOutputTokens: AI_DEFAULTS.maxOutputTokens,
    system: redactText(input.instructions),
    prompt: redactText(input.input),
    schema: jsonSchema<T>(input.schema),
  });
  return result.object as T;
}

export async function responsesText(input: {
  instructions: string;
  prompt: string;
  chat?: ChatRequestOptions;
  messages?: ChatMessage[];
}): Promise<string> {
  const { model, config } = resolveChatModel(input.chat);
  const messages = sanitizeMessages(input.messages);
  const base = {
    model,
    temperature: config.temperature,
    maxOutputTokens: AI_DEFAULTS.maxOutputTokens,
    system: redactText(input.instructions),
  };
  const result = messages
    ? await generateText({
        ...base,
        messages: [
          ...messages,
          { role: "user", content: redactText(input.prompt) },
        ],
      })
    : await generateText({ ...base, prompt: redactText(input.prompt) });
  return result.text?.trim() ?? "";
}

export function isOpenAiConfigured(): boolean {
  return isOpenAiChatConfigured();
}

export function isChatProviderConfigured(): boolean {
  return isAnyChatProviderConfigured();
}

/** Stream plain-text tokens from the selected chat provider. */
export async function responsesTextStream(
  input: {
    instructions: string;
    prompt: string;
    signal?: AbortSignal;
    chat?: ChatRequestOptions;
    messages?: ChatMessage[];
  },
  handlers: { onDelta: (chunk: string) => void }
): Promise<string> {
  const { model, config } = resolveChatModel(input.chat);
  const messages = sanitizeMessages(input.messages);
  const base = {
    model,
    temperature: config.temperature,
    maxOutputTokens: AI_DEFAULTS.maxOutputTokens,
    system: redactText(input.instructions),
    abortSignal: input.signal,
  };
  const response = messages
    ? streamText({
        ...base,
        messages: [
          ...messages,
          { role: "user", content: redactText(input.prompt) },
        ],
      })
    : streamText({ ...base, prompt: redactText(input.prompt) });

  let fullText = "";
  for await (const delta of response.textStream) {
    if (!delta) continue;
    fullText += delta;
    handlers.onDelta(delta);
  }

  return fullText.trim();
}
