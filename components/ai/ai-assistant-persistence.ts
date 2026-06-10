import type { IndexOpenApiResult } from "@/domain/ai/types";
import type { AiChatProvider } from "@/domain/ai/chat-provider";

export type PersistedChatMessage = {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  citedEndpoints?: string[];
};

export type PersistedAiAssistantState = {
  messages: PersistedChatMessage[];
  activeTab?: string;
  chatProvider?: AiChatProvider;
  chatModel?: string;
  connectionId?: string;
  indexResult?: IndexOpenApiResult | null;
};

export function aiAssistantStorageKey(specId: string): string {
  return `ai_assistant_state:${specId}`;
}

export function loadAiAssistantState(
  specId: string
): PersistedAiAssistantState {
  const fallback: PersistedAiAssistantState = {
    messages: [],
    activeTab: "qa",
    indexResult: null,
  };
  try {
    const raw = localStorage.getItem(aiAssistantStorageKey(specId));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as PersistedAiAssistantState & {
      /** @deprecated merged into ai_assistant_state */
      messages?: PersistedChatMessage[];
    };
    const legacyKey = `ai_assistant_chat:${specId}`;
    let legacy: PersistedAiAssistantState | null = null;
    try {
      const legacyRaw = localStorage.getItem(legacyKey);
      if (legacyRaw) legacy = JSON.parse(legacyRaw) as PersistedAiAssistantState;
    } catch {
      legacy = null;
    }

    const messages = Array.isArray(parsed.messages)
      ? parsed.messages
      : Array.isArray(legacy?.messages)
        ? legacy.messages
        : [];

    return {
      messages,
      activeTab: parsed.activeTab ?? legacy?.activeTab ?? "qa",
      chatProvider: parsed.chatProvider ?? legacy?.chatProvider,
      chatModel: parsed.chatModel ?? legacy?.chatModel,
      connectionId: parsed.connectionId ?? legacy?.connectionId,
      indexResult:
        parsed.indexResult !== undefined
          ? parsed.indexResult
          : legacy?.indexResult ?? null,
    };
  } catch {
    return fallback;
  }
}

export function saveAiAssistantState(
  specId: string,
  state: PersistedAiAssistantState
): void {
  try {
    localStorage.setItem(
      aiAssistantStorageKey(specId),
      JSON.stringify({
        messages: state.messages.slice(-50),
        activeTab: state.activeTab,
        chatProvider: state.chatProvider,
        chatModel: state.chatModel,
        connectionId: state.connectionId,
        indexResult: state.indexResult,
      })
    );
  } catch {
    // ignore quota errors
  }
}
