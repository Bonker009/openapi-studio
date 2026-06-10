export type UnifiedStreamPhase =
  | "thinking"
  | "planning-search"
  | "searching-api"
  | "searching-db"
  | "running-sql"
  | "generating"
  | "retrieving"
  | "streaming";

export type StreamUnifiedChatDone = {
  answer: string;
  citedEndpoints: string[];
  toolsUsed?: string[];
  connectionId?: string;
  modelsUsed?: unknown;
  promptVersion?: string;
};

export type StreamUnifiedChatCallbacks = {
  onOpen?: () => void;
  onStatus?: (phase: UnifiedStreamPhase) => void;
  onDelta: (text: string) => void;
  onDone: (result: StreamUnifiedChatDone) => void;
  onError: (message: string) => void;
};

export async function streamUnifiedChatRequest(
  input: {
    specId: string;
    question: string;
    connectionId?: string;
    conversationId?: string;
    chatProvider?: "openai" | "groq";
    chatModel?: string;
    history?: { role: "user" | "assistant"; content: string }[];
    signal?: AbortSignal;
  },
  callbacks: StreamUnifiedChatCallbacks
): Promise<void> {
  let response: Response;
  try {
    response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        specId: input.specId,
        question: input.question,
        connectionId: input.connectionId,
        conversationId: input.conversationId,
        stream: true,
        chatProvider: input.chatProvider,
        chatModel: input.chatModel,
        history: input.history,
      }),
      signal: input.signal,
    });
  } catch (error) {
    if (input.signal?.aborted) {
      callbacks.onError("Generation stopped");
      return;
    }
    callbacks.onError(
      error instanceof Error ? error.message : "Network request failed"
    );
    return;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok) {
    try {
      const json = (await response.json()) as { error?: string };
      callbacks.onError(json.error ?? `Request failed (${response.status})`);
    } catch {
      callbacks.onError(`Request failed (${response.status})`);
    }
    return;
  }

  callbacks.onOpen?.();

  if (!contentType.includes("text/event-stream") || !response.body) {
    try {
      const json = (await response.json()) as StreamUnifiedChatDone & {
        error?: string;
      };
      if (json.error) {
        callbacks.onError(json.error);
        return;
      }
      callbacks.onDelta(json.answer);
      callbacks.onDone({
        answer: json.answer,
        citedEndpoints: json.citedEndpoints ?? [],
        toolsUsed: json.toolsUsed,
        connectionId: json.connectionId,
        modelsUsed: json.modelsUsed,
        promptVersion: json.promptVersion,
      });
    } catch {
      callbacks.onError("Unexpected response from server");
    }
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const unifiedPhases = new Set([
    "thinking",
    "planning-search",
    "searching-api",
    "searching-db",
    "running-sql",
    "generating",
    "retrieving",
  ]);

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const segments = buffer.split("\n\n");
    buffer = segments.pop() ?? "";

    for (const segment of segments) {
      const lines = segment.split("\n");
      let eventType = "message";
      let dataLine = "";
      for (const line of lines) {
        if (line.startsWith("event:")) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLine += line.slice(5).trim();
        }
      }
      if (!dataLine) continue;
      try {
        const payload = JSON.parse(dataLine) as Record<string, unknown>;
        if (eventType === "status" && typeof payload.phase === "string") {
          const phase = payload.phase as UnifiedStreamPhase;
          if (unifiedPhases.has(phase)) {
            callbacks.onStatus?.(phase);
          }
        } else if (eventType === "delta" && typeof payload.text === "string") {
          callbacks.onDelta(payload.text);
        } else if (eventType === "done") {
          callbacks.onDone({
            answer: String(payload.answer ?? ""),
            citedEndpoints: Array.isArray(payload.citedEndpoints)
              ? (payload.citedEndpoints as string[])
              : [],
            toolsUsed: Array.isArray(payload.toolsUsed)
              ? (payload.toolsUsed as string[])
              : undefined,
            connectionId:
              typeof payload.connectionId === "string"
                ? payload.connectionId
                : undefined,
            modelsUsed: payload.modelsUsed,
            promptVersion:
              typeof payload.promptVersion === "string"
                ? payload.promptVersion
                : undefined,
          });
        } else if (eventType === "error") {
          callbacks.onError(
            String(payload.message ?? payload.error ?? "Stream failed")
          );
        }
      } catch {
        // ignore parse errors
      }
    }
  }
}
