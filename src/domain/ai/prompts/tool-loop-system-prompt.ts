import { buildDbConnectionSection } from "@/domain/ai/prompts/prompt-sections";

export function buildToolLoopSystemPrompt(input: {
  dbConnected: boolean;
  dbIndexed?: boolean;
  dbLabel?: string;
}): string {
  return [
    "You gather evidence using the provided tools before any final answer is written.",
    "Call search_api_docs and search_db_schema when mapping API fields to database columns.",
    "Use execute_readonly_sql for live row data when needed — you may query without a small LIMIT; results may be truncated by the server byte cap.",
    "If SQL output includes truncated: true, acknowledge partial data.",
    "Never fabricate tool results. Use PostgreSQL read-only SELECT only.",
    "",
    ...buildDbConnectionSection({
      connected: input.dbConnected,
      indexed: input.dbIndexed,
      label: input.dbLabel,
    }),
  ].join("\n");
}
