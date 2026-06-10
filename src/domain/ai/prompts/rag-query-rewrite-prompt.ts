import type { QAHistoryMessage } from "@/domain/ai/types";
import {
  buildConversationSection,
  buildFollowUpResolutionRules,
} from "@/domain/ai/prompts/prompt-sections";

export function buildRagQueryRewritePrompt(input: {
  question: string;
  history?: QAHistoryMessage[];
}): string {
  return [
    "Rewrite the user's question into a single-line search query for retrieving OpenAPI and database schema chunks.",
    "Include endpoint paths, HTTP methods, table names, and field names when relevant.",
    "Output ONLY the search query line — no explanation, no markdown.",
    "",
    ...buildFollowUpResolutionRules(),
    ...buildConversationSection(input.history),
    `Current question: ${input.question}`,
    "",
    "Search query:",
  ].join("\n");
}
