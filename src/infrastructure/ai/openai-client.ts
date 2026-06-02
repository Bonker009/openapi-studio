import { AI_DEFAULTS } from "@/domain/ai/config";
import { redactText } from "@/infrastructure/ai/security/redaction";

export type OpenAiConfig = {
  apiKey: string;
  baseUrl?: string;
  chatModel?: string;
  embeddingModel?: string;
  temperature?: number;
};

function getConfig(): OpenAiConfig {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return {
    apiKey,
    baseUrl: process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1",
    chatModel: process.env.OPENAI_CHAT_MODEL?.trim() || AI_DEFAULTS.chatModel,
    embeddingModel:
      process.env.OPENAI_EMBEDDING_MODEL?.trim() || AI_DEFAULTS.embeddingModel,
    temperature: AI_DEFAULTS.temperature,
  };
}

export async function createEmbedding(text: string): Promise<number[]> {
  const cfg = getConfig();
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

export async function responsesJson<T>(input: {
  instructions: string;
  input: string;
  schemaName: string;
  schema: Record<string, unknown>;
}): Promise<T> {
  const cfg = getConfig();
  const res = await fetch(`${cfg.baseUrl}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: cfg.chatModel,
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
    throw new Error(data.error?.message ?? `OpenAI responses failed (${res.status})`);
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

export async function responsesText(input: {
  instructions: string;
  prompt: string;
}): Promise<string> {
  const cfg = getConfig();
  const res = await fetch(`${cfg.baseUrl}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: cfg.chatModel,
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
    throw new Error(data.error?.message ?? `OpenAI responses failed (${res.status})`);
  }
  return data.output_text?.trim() ?? "";
}

export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/**
 * Extract incremental text from a Responses API SSE event.
 *
 * Only true delta events carry incremental tokens. Completion events such as
 * `response.output_text.done` and `response.content_part.done` repeat the FULL
 * answer text; treating those as deltas duplicates the whole answer once per
 * event (observed as the answer appearing 2-3x). So we accept ONLY delta events.
 */
function extractStreamTextDelta(event: unknown): string | null {
  if (!event || typeof event !== "object") return null;
  const record = event as Record<string, unknown>;
  const type = String(record.type ?? "");

  if (type && !type.endsWith(".delta")) return null;
  if (typeof record.delta === "string") return record.delta;

  return null;
}

/** Stream plain-text tokens from OpenAI Responses API (SSE). */
export async function responsesTextStream(
  input: {
    instructions: string;
    prompt: string;
    signal?: AbortSignal;
  },
  handlers: { onDelta: (chunk: string) => void }
): Promise<string> {
  const cfg = getConfig();
  const res = await fetch(`${cfg.baseUrl}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      model: cfg.chatModel,
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

  const reader = res.body.getReader();
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
        const delta = extractStreamTextDelta(parsed);
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
