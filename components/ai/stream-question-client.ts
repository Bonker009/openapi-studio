export type StreamQuestionDone = {
  answer: string;
  citedEndpoints: string[];
};

export type StreamQuestionStatusPhase = "retrieving" | "generating";

export type StreamQuestionCallbacks = {
  /** Response received and SSE (or JSON fallback) is ready. */
  onOpen?: () => void;
  onStatus?: (phase: StreamQuestionStatusPhase) => void;
  onDelta: (text: string) => void;
  onDone: (result: StreamQuestionDone) => void;
  onError: (message: string) => void;
};

export type StreamQuestionChatSelection = {
  provider: "openai" | "groq";
  model: string;
};

export async function streamQuestionRequest(
  input: {
    specId: string;
    question: string;
    conversationId?: string;
    chatProvider?: "openai" | "groq";
    chatModel?: string;
    signal?: AbortSignal;
  },
  callbacks: StreamQuestionCallbacks
): Promise<void> {
  let response: Response;
  try {
    response = await fetch("/api/ai/question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        specId: input.specId,
        question: input.question,
        conversationId: input.conversationId,
        stream: true,
        chatProvider: input.chatProvider,
        chatModel: input.chatModel,
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
      const json = (await response.json()) as StreamQuestionDone & {
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
      });
    } catch {
      callbacks.onError("Unexpected response from server");
    }
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

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
        if (
          eventType === "status" &&
          (payload.phase === "retrieving" || payload.phase === "generating")
        ) {
          callbacks.onStatus?.(payload.phase);
        } else if (eventType === "delta" && typeof payload.text === "string") {
          callbacks.onDelta(payload.text);
        } else if (eventType === "done") {
          callbacks.onDone({
            answer: String(payload.answer ?? ""),
            citedEndpoints: Array.isArray(payload.citedEndpoints)
              ? (payload.citedEndpoints as string[])
              : [],
          });
        } else if (eventType === "error") {
          callbacks.onError(String(payload.error ?? "Stream failed"));
        }
      } catch {
        // ignore parse errors
      }
    }
  }
}
