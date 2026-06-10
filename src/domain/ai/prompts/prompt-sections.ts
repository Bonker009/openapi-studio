import type { QAHistoryMessage } from "@/domain/ai/types";

export const PROMPT_VERSION = "unified-v1";

const TOOL_RESULTS_CHAR_CAP = 8000;

export type ToolResultBlock = {
  toolName: string;
  output: string;
  truncated?: boolean;
};

export function buildConversationSection(
  history: QAHistoryMessage[] | undefined,
  maxTurns = 12
): string[] {
  const turns = (history ?? []).slice(-maxTurns);
  if (!turns.length) return [];
  return [
    "Conversation so far:",
    ...turns.map((m) => `- ${m.role}: ${m.content.slice(0, 500)}`),
    "Use this conversation to resolve references like 'that body' or 'the previous endpoint'.",
    "",
  ];
}

export function buildFollowUpResolutionRules(): string[] {
  return [
    "When the user refers to prior messages ('that', 'it', 'the body above'), resolve from conversation history.",
    "",
  ];
}

export function buildGroundingRules(): string[] {
  return [
    "Ground answers in tool evidence and the endpoint catalog. Never invent endpoints, fields, tables, or SQL results.",
    "Never ask for or reveal database passwords.",
    "",
  ];
}

export function buildCitationRules(): string[] {
  return [
    "Cite endpoints as METHOD /path when relevant.",
    "Cite database tables and columns when mapping fields.",
    "When evidence is partial, state confidence (high/medium/low) and offer brief alternatives.",
    "",
  ];
}

export function buildEndpointCatalogSection(endpoints: string[]): string[] {
  const total = endpoints.length;
  return [
    `This spec has exactly ${total} endpoint${total === 1 ? "" : "s"}.`,
    "The list below is the COMPLETE authoritative set:",
    ...endpoints.map((e) => `- ${e}`),
    "",
  ];
}

export function buildDbConnectionSection(input: {
  connected: boolean;
  indexed?: boolean;
  label?: string;
}): string[] {
  if (!input.connected) {
    return [
      "Database: not connected. Answer from API evidence only; note that DB schema tools are unavailable.",
      "",
    ];
  }
  const idx = input.indexed
    ? "schema indexed"
    : "not indexed — run Index schema in the Database tab";
  return [
    `Database: connected (${input.label ?? "connection"}) — ${idx}.`,
    "",
  ];
}

export function buildToolResultsSection(
  results: ToolResultBlock[],
  charCap = TOOL_RESULTS_CHAR_CAP
): string[] {
  if (!results.length) {
    return ["## Evidence from tools", "(none — answer from conversation and endpoint list only)", ""];
  }
  const lines = ["## Evidence from tools", ""];
  let used = lines.join("\n").length;

  for (const block of results) {
    const header = `### ${block.toolName}`;
    let body = block.output;
    const remaining = charCap - used - header.length - 50;
    if (remaining <= 0) break;
    if (body.length > remaining) {
      body = `${body.slice(0, remaining)}…`;
    }
    const section = `${header}\n${body}${block.truncated ? "\n(note: tool output was truncated)" : ""}\n`;
    lines.push(section);
    used += section.length;
    if (used >= charCap) break;
  }
  return lines;
}
