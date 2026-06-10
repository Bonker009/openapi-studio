# AI prompt modules and multi-model routing

## Task → model → env

| Task | Env vars | Resolved by | User-visible |
|------|----------|-------------|--------------|
| `embedding` | `OPENAI_EMBEDDING_MODEL` | `resolveTaskModel("embedding")` | No (indexing) |
| `rag_query` | `AI_RAG_QUERY_PROVIDER`, `AI_RAG_QUERY_MODEL` | `resolveTaskModel("rag_query")` | Hint in chat UI if set |
| `tool_loop` | `AI_AGENT_TOOL_PROVIDER`, `AI_AGENT_TOOL_MODEL` | `resolveTaskModel("tool_loop")` | Hint in chat UI |
| `answer` | UI `chatProvider` + `chatModel` | `resolveTaskModel("answer", selection)` | Model picker |

If `AI_RAG_QUERY_*` unset, retrieval uses the raw user question (no rewrite step).

## Prompt file → phase

| File | Used in phase | Purpose |
|------|---------------|---------|
| `rag-query-rewrite-prompt.ts` | Before tool loop | Single-line search query from question + history |
| `tool-loop-system-prompt.ts` | Tool loop | Which tools to call; DB connected/indexed hints |
| `answer-synthesis-prompt.ts` | Answer stream | Evidence blocks + question → streaming answer |
| `unified-assistant-system.ts` | Answer stream | System role for final response |
| `prompt-sections.ts` | All synthesis | Shared: grounding, citations, conversation, tool results cap |
| `documentation-prompt-builder.ts` | Legacy docs Q&A | Refactored to use `prompt-sections` |

## Editing guidelines

1. **Shared rules** belong in `prompt-sections.ts` — import into task prompts, do not duplicate.
2. **Tool results** are capped at 8000 chars in `buildToolResultsSection`; truncation flag preserved for SQL byte-cap.
3. **Versioning:** update `PROMPT_VERSION` (e.g. `unified-v1`) when changing behavior clients or evals depend on.
4. **No secrets** in prompts — never include connection passwords or API keys.
5. **Citations:** answer prompts require `METHOD /path` for API and table/column names for DB evidence.

## Agent env reference

```bash
UNIFIED_AGENT_MAX_STEPS=8
AI_RAG_QUERY_PROVIDER=groq
AI_RAG_QUERY_MODEL=llama-3.1-8b-instant
AI_AGENT_TOOL_PROVIDER=groq
AI_AGENT_TOOL_MODEL=llama-3.3-70b-versatile
AI_DB_QUERY_INJECT_LIMIT=false
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```
