import type { AiChatProvider } from "@/domain/ai/chat-provider";
import { AI_DEFAULTS } from "@/domain/ai/config";

const GROQ_MODEL_LABELS: Record<string, string> = {
  [AI_DEFAULTS.groqChatModel]: "Llama 3.3 70B",
  "llama-3.1-8b-instant": "Llama 3.1 8B Instant",
};

/** Human-readable label for provider/model dropdowns. */
export function formatChatModelLabel(
  provider: AiChatProvider,
  modelId: string
): string {
  if (provider === "groq") {
    return GROQ_MODEL_LABELS[modelId] ?? modelId;
  }
  return modelId;
}
