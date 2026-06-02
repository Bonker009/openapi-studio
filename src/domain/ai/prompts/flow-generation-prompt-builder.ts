export function buildPlannerPrompt(input: {
  userIntent: string;
  allowedEndpoints: string[];
  contextBlocks: string[];
}): string {
  return [
    "You are an API test planner. Create a numbered step plan using ONLY endpoints from the allowed list.",
    "Do not invent endpoints. Prefer login/auth first when required.",
    "",
    `User intent: ${input.userIntent}`,
    "",
    "Allowed endpoints:",
    ...input.allowedEndpoints.map((e) => `- ${e}`),
    "",
    "OpenAPI context:",
    ...input.contextBlocks,
    "",
    "Return plain text steps only, one per line, format: 1. Action (METHOD /path)",
  ].join("\n");
}

export function buildFlowGeneratorPrompt(input: {
  plan: string;
  allowedEndpoints: string[];
  contextBlocks: string[];
}): string {
  return [
    "Convert the plan into strict JSON with nodes and edges only.",
    "Rules:",
    "- nodes[].type must be REQUEST",
    "- nodes[].endpoint must exactly match an allowed endpoint string",
    "- edges connect step ids in execution order; use type success unless failure branch needed",
    "- include start-to-end connectivity; no orphan nodes",
    "",
    "Allowed endpoints:",
    ...input.allowedEndpoints.map((e) => `- ${e}`),
    "",
    "Plan:",
    input.plan,
    "",
    "OpenAPI context:",
    ...input.contextBlocks,
    "",
    'Return JSON only: {"nodes":[...],"edges":[...]}',
  ].join("\n");
}

export function buildFlowFixPrompt(input: {
  invalidJson: string;
  errors: string[];
  allowedEndpoints: string[];
  contextBlocks: string[];
}): string {
  return [
    "Fix the flow JSON. Return corrected JSON only.",
    "Do not add fields outside nodes/edges node shape.",
    "Use only allowed endpoints.",
    "",
    "Validation errors:",
    ...input.errors.map((e) => `- ${e}`),
    "",
    "Allowed endpoints:",
    ...input.allowedEndpoints.map((ep) => `- ${ep}`),
    "",
    "Invalid JSON:",
    input.invalidJson,
    "",
    "OpenAPI context:",
    ...input.contextBlocks,
  ].join("\n");
}
