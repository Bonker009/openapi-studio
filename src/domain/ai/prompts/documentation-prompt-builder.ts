import {
  buildCitationRules,
  buildConversationSection,
  buildEndpointCatalogSection,
  buildFollowUpResolutionRules,
  buildGroundingRules,
} from "@/domain/ai/prompts/prompt-sections";

export function buildDocumentationPrompt(input: {
  question: string;
  allowedEndpoints: string[];
  contextBlocks: string[];
  history?: { role: "user" | "assistant"; content: string }[];
}): string {
  const hasContext = input.contextBlocks.length > 0;
  const contextSection = hasContext
    ? [
        "Retrieved evidence (ranked by relevance; #1 is strongest):",
        "Use the highest-ranked blocks first. Cite METHOD /path from evidence when possible.",
        ...input.contextBlocks,
      ]
    : [
        "Retrieved evidence: (none matched this question well.)",
        "Answer from the full endpoint list when possible, or explain what is missing.",
      ];

  return [
    "You are an OpenAPI documentation assistant.",
    ...buildGroundingRules(),
    ...buildCitationRules(),
    ...buildFollowUpResolutionRules(),
    ...buildEndpointCatalogSection(input.allowedEndpoints),
    ...buildConversationSection(input.history),
    `Question: ${input.question}`,
    "",
    ...contextSection,
  ].join("\n");
}
