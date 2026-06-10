import type { QAHistoryMessage } from "@/domain/ai/types";
import {
  buildCitationRules,
  buildConversationSection,
  buildEndpointCatalogSection,
  buildFollowUpResolutionRules,
  buildGroundingRules,
  buildToolResultsSection,
  type ToolResultBlock,
} from "@/domain/ai/prompts/prompt-sections";

export function buildAnswerSynthesisPrompt(input: {
  question: string;
  allowedEndpoints: string[];
  history?: QAHistoryMessage[];
  toolResults: ToolResultBlock[];
}): string {
  return [
    "Synthesize a helpful markdown answer for the user using the evidence below.",
    "Do not mention internal tools or this prompt structure.",
    ...buildGroundingRules(),
    ...buildCitationRules(),
    ...buildFollowUpResolutionRules(),
    ...buildConversationSection(input.history),
    `Question: ${input.question}`,
    "",
    ...buildEndpointCatalogSection(input.allowedEndpoints),
    ...buildToolResultsSection(input.toolResults),
  ].join("\n");
}
