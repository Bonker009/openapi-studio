export function buildDocumentationPrompt(input: {
  question: string;
  allowedEndpoints: string[];
  contextBlocks: string[];
}): string {
  const total = input.allowedEndpoints.length;
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
    "Ground answers in the authoritative endpoint list and retrieved evidence below.",
    "Never invent endpoints, fields, or auth requirements not present in this prompt.",
    "Cite endpoints as METHOD /path when relevant.",
    "",
    "When evidence is partial or ambiguous:",
    "- Give your best-supported answer and state confidence (high/medium/low).",
    "- Offer 1–2 plausible alternatives if multiple endpoints could match.",
    "- Do not reply with only \"cannot find\" if the endpoint list or evidence gives a reasonable best guess.",
    "",
    `This spec has exactly ${total} endpoint${total === 1 ? "" : "s"}.`,
    "The list under \"All endpoints\" is the COMPLETE, authoritative set of every",
    "endpoint in this spec. For counting, listing, grouping, or \"how many\" questions,",
    "use that full list (not only the retrieved evidence section).",
    "",
    `Question: ${input.question}`,
    "",
    `All endpoints (${total} total, authoritative):`,
    ...input.allowedEndpoints.map((e) => `- ${e}`),
    "",
    ...contextSection,
  ].join("\n");
}
