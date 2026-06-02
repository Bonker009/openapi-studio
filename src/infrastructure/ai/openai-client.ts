import { AI_DEFAULTS } from "@/domain/ai/config";
import type { ChatModelSelection } from "@/domain/ai/chat-provider";
import {
  isAnyChatProviderConfigured,
  isOpenAiChatConfigured,
  resolveChatRuntimeConfig,
} from "@/infrastructure/ai/chat-provider-config";
import { redactText } from "@/infrastructure/ai/security/redaction";

export type ChatRequestOptions = Partial<ChatModelSelection>;

type EmbeddingConfig = {
  apiKey: string;
  baseUrl: string;
  embeddingModel: string;
};

function getEmbeddingConfig(): EmbeddingConfig {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not configured (required for embeddings/indexing)"
    );
  }
  return {
    apiKey,
    baseUrl:
      process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1",
    embeddingModel:
      process.env.OPENAI_EMBEDDING_MODEL?.trim() || AI_DEFAULTS.embeddingModel,
  };
}

export async function createEmbedding(text: string): Promise<number[]> {
  const cfg = getEmbeddingConfig();
  const res = await fetch(`${cfg.baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: cfg.embeddingModel,
      input: redactText(text).slice(0, 8000),
    }),
  });
  const data = (await res.json()) as {
    data?: { embedding?: number[] }[];
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Embeddings failed (${res.status})`);
  }
  const vector = data.data?.[0]?.embedding;
  if (!vector?.length) throw new Error("Empty embedding response");
  return vector;
}

function extractResponsesStreamTextDelta(event: unknown): string | null {
  if (!event || typeof event !== "object") return null;
  const record = event as Record<string, unknown>;
  const type = String(record.type ?? "");
  if (type && !type.endsWith(".delta")) return null;
  if (typeof record.delta === "string") return record.delta;
  return null;
}

function extractChatCompletionsStreamDelta(event: unknown): string | null {
  if (!event || typeof event !== "object") return null;
  const record = event as Record<string, unknown>;
  const choices = record.choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const choice = choices[0] as Record<string, unknown>;
  const delta = choice.delta;
  if (!delta || typeof delta !== "object") return null;
  const content = (delta as { content?: string }).content;
  return typeof content === "string" ? content : null;
}

async function chatCompletionsRequest(input: {
  cfg: ReturnType<typeof resolveChatRuntimeConfig>;
  messages: { role: "system" | "user"; content: string }[];
  stream?: boolean;
  jsonMode?: boolean;
  signal?: AbortSignal;
}): Promise<Response> {
  const body: Record<string, unknown> = {
    model: input.cfg.model,
    temperature: input.cfg.temperature,
    messages: input.messages.map((m) => ({
      role: m.role,
      content: redactText(m.content),
    })),
    max_tokens: AI_DEFAULTS.maxOutputTokens,
  };
  if (input.jsonMode) {
    body.response_format = { type: "json_object" };
  }
  if (input.stream) {
    body.stream = true;
  }

  return fetch(`${input.cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.cfg.apiKey}`,
      "Content-Type": "application/json",
      ...(input.stream ? { Accept: "text/event-stream" } : {}),
    },
    body: JSON.stringify(body),
    signal: input.signal,
  });
}

export async function responsesJson<T>(input: {
  instructions: string;
  input: string;
  schemaName: string;
  schema: Record<string, unknown>;
  chat?: ChatRequestOptions;
}): Promise<T> {
  const cfg = resolveChatRuntimeConfig(input.chat);

  if (cfg.useResponsesApi) {
    const res = await fetch(`${cfg.baseUrl}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: cfg.temperature,
        instructions: input.instructions,
        input: redactText(input.input),
        text: {
          format: {
            type: "json_schema",
            name: input.schemaName,
            schema: input.schema,
            strict: true,
          },
        },
      }),
    });

    const data = (await res.json()) as {
      output_text?: string;
      output?: { type?: string; content?: { type?: string; text?: string }[] }[];
      error?: { message?: string };
    };

    if (!res.ok) {
      throw new Error(
        data.error?.message ?? `OpenAI responses failed (${res.status})`
      );
    }

    let text = data.output_text;
    if (!text && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item.type === "message" && Array.isArray(item.content)) {
          for (const part of item.content) {
            if (part.type === "output_text" && part.text) {
              text = part.text;
            }
          }
        }
      }
    }
    if (!text?.trim()) {
      throw new Error("OpenAI returned empty structured output");
    }
    return JSON.parse(text) as T;
  }

  const userContent = [
    redactText(input.input),
    "",
    `Respond with valid JSON only for schema "${input.schemaName}".`,
    JSON.stringify(input.schema),
  ].join("\n");

  const res = await chatCompletionsRequest({
    cfg,
    messages: [
      { role: "system", content: input.instructions },
      { role: "user", content: userContent },
    ],
    jsonMode: true,
  });

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(
      data.error?.message ?? `Chat completions failed (${res.status})`
    );
  }
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Chat provider returned empty structured output");
  return JSON.parse(text) as T;
}

export async function responsesText(input: {
  instructions: string;
  prompt: string;
  chat?: ChatRequestOptions;
}): Promise<string> {
  const cfg = resolveChatRuntimeConfig(input.chat);

  if (cfg.useResponsesApi) {
    const res = await fetch(`${cfg.baseUrl}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: cfg.temperature,
        instructions: input.instructions,
        input: redactText(input.prompt),
        max_output_tokens: AI_DEFAULTS.maxOutputTokens,
      }),
    });
    const data = (await res.json()) as {
      output_text?: string;
      error?: { message?: string };
    };
    if (!res.ok) {
      throw new Error(
        data.error?.message ?? `OpenAI responses failed (${res.status})`
      );
    }
    return data.output_text?.trim() ?? "";
  }

  const res = await chatCompletionsRequest({
    cfg,
    messages: [
      { role: "system", content: input.instructions },
      { role: "user", content: input.prompt },
    ],
  });
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(
      data.error?.message ?? `Chat completions failed (${res.status})`
    );
  }
  return data.choices?.[0]?.message?.content?.trim() ?? "";
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
  },
  handlers: { onDelta: (chunk: string) => void }
): Promise<string> {
  const cfg = resolveChatRuntimeConfig(input.chat);

  if (cfg.useResponsesApi) {
    const res = await fetch(`${cfg.baseUrl}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: cfg.temperature,
        instructions: input.instructions,
        input: redactText(input.prompt),
        max_output_tokens: AI_DEFAULTS.maxOutputTokens,
        stream: true,
      }),
      signal: input.signal,
    });

    if (!res.ok) {
      let message = `OpenAI responses failed (${res.status})`;
      try {
        const err = (await res.json()) as { error?: { message?: string } };
        message = err.error?.message ?? message;
      } catch {
        /* ignore */
      }
      throw new Error(message);
    }

    if (!res.body) {
      throw new Error("OpenAI returned empty stream body");
    }

    return readSseStream(res.body, extractResponsesStreamTextDelta, handlers);
  }

  const res = await chatCompletionsRequest({
    cfg,
    messages: [
      { role: "system", content: input.instructions },
      { role: "user", content: input.prompt },
    ],
    stream: true,
    signal: input.signal,
  });

  if (!res.ok) {
    let message = `Chat completions failed (${res.status})`;
    try {
      const err = (await res.json()) as { error?: { message?: string } };
      message = err.error?.message ?? message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  if (!res.body) {
    throw new Error("Chat provider returned empty stream body");
  }

  return readSseStream(res.body, extractChatCompletionsStreamDelta, handlers);
}

async function readSseStream(
  body: ReadableStream<Uint8Array>,
  extractDelta: (event: unknown) => string | null,
  handlers: { onDelta: (chunk: string) => void }
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";

    for (const line of parts) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const parsed = JSON.parse(payload) as unknown;
        const delta = extractDelta(parsed);
        if (delta) {
          fullText += delta;
          handlers.onDelta(delta);
        }
      } catch {
        // ignore malformed SSE chunks
      }
    }
  }

  return fullText.trim();
}
