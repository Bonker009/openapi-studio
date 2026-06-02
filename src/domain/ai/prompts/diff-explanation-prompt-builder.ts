export function buildDiffExplanationPrompt(input: {
  beforeSummary: string;
  afterSummary: string;
}): string {
  return [
    "Explain API spec changes between versions for engineers.",
    "Be concise, structured, and mention breaking changes first.",
    "",
    "Before:",
    input.beforeSummary,
    "",
    "After:",
    input.afterSummary,
  ].join("\n");
}
