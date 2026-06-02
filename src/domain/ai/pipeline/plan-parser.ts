import type { FlowGenerationPlan } from "@/domain/ai/types";

export function parsePlanFromText(
  planText: string,
  intent: string
): FlowGenerationPlan {
  const lines = planText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const steps = lines.map((line, index) => {
    const endpointMatch = line.match(
      /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\/[^\s),]+)/i
    );
    return {
      order: index + 1,
      action: line.replace(/^\d+[\).\s]+/, "").trim() || line,
      endpoint: endpointMatch
        ? `${endpointMatch[1].toUpperCase()} ${endpointMatch[2]}`
        : undefined,
      notes: undefined,
    };
  });
  return { intent, steps };
}
