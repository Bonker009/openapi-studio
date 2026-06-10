---
name: list-endpoints
description: >-
  Guides work on the api_feedback Next.js app: OpenAPI docs, unified AI chat,
  DB connections, Liam ERD, playground flows, Drizzle/Postgres, and Docker.
  Use when editing this repo, adding API routes, AI prompts, DB features,
  or debugging Docker/production issues.
---

# list-endpoints (api_feedback)

## Layer map

| Layer | Path | Responsibility |
|-------|------|----------------|
| Routes | `app/` | Pages, layouts, API route handlers (thin) |
| Features | `src/features/` | Orchestration, services (`unified-assistant-service`, `liam-erd-service`) |
| Domain | `src/domain/` | Pure logic, prompts, SQL policy, OpenAPI diff |
| Infrastructure | `src/infrastructure/` | DB repos, AI tools, RAG, proxy |
| UI | `components/` | React components; `components/ui/` = shadcn |
| Lib | `lib/` | Security, route helpers, legacy re-exports |

Import aliases: `@/domain/*`, `@/features/*`, `@/infrastructure/*`, `@/components/*`.

## AI chat checklist

When changing unified chat:

1. **Service:** `src/features/ai/unified-assistant-service.ts` — rag rewrite → tool loop → answer stream
2. **Tools:** `src/infrastructure/ai/unified-assistant-tools.ts` — add focused tools; DB tools only when `connectionId` set
3. **API:** `app/api/ai/chat/route.ts` — SSE phases; `app/api/ai/config/route.ts` — task models catalog
4. **Client:** `components/ai/stream-unified-chat-client.ts` + `ai-assistant-content.tsx`
5. **Do not** add keyword/intent routers — the model selects tools from conversation
6. **Prompts:** edit files under `src/domain/ai/prompts/` (see `prompts.md` in this skill folder)

## Prompt editing

- Use builders from `prompt-sections.ts` for shared rules (grounding, citations, tool results truncation)
- Task-specific files: `rag-query-rewrite-prompt.ts`, `tool-loop-system-prompt.ts`, `answer-synthesis-prompt.ts`
- Bump `PROMPT_VERSION` in `prompt-sections.ts` when prompt behavior changes materially
- Full task → env → file mapping: [prompts.md](./prompts.md)

## DB feature checklist

1. **Guard:** `guardDbRoute(request)` on every `app/api/db/*` route
2. **Scope:** `validateSpecId(specId)` + `postgresDbConnectionRepository.findForSpec(specId, connectionId)`
3. **SQL:** `sanitizeReadOnlySql` / `executeAgentReadOnlyQuery` for agent path (`AI_DB_QUERY_INJECT_LIMIT=false` by default)
4. **Schema:** snapshots in `db_schema_snapshots` — introspect via `/api/db/connections/[id]/introspect` or `/api/db/index`
5. **Browse/values:** allowlist tables/columns from snapshot (`db-schema-guard.ts`)

## ERD / Liam CLI

- Page: `/documentation/[specId]/erd` — paste schema (postgres / prisma / drizzle); no DB connection required
- Build API: `POST /api/db/erd/build?specId=` → `ensureErdBuildFromPaste` → `@liam-hq/cli erd build --format <format>`
- Paste cache: `LIAM_ERD_CACHE_DIR/paste/{specId}/{cacheKey}/` where `cacheKey = hash(format + content)`
- Asset URL: `/api/db/erd/{specId}/{cacheKey}/` (specId in path so relative CSS/JS resolve)
- Legacy connection build: `snapshotToPgsqlDdl` → cache under `{connectionId}/{hash(introspectedAt)}`
- Validation: `src/domain/db/erd-paste-schema.ts`; security limits in `erd-security.ts`
- **Docker:** Next standalone does not trace subprocess deps. Image build must run `scripts/stage-liam-cli-deps.mjs` in Dockerfile `externals` stage. Error `Cannot find package 'commander'` means rebuild image.

## Testing

- Runner: `tsx --test` (no Jest)
- Add every new test file path to `package.json` `scripts.test`
- Co-locate tests in `lib/` mirroring `src/` domains
- Run `npm test` and `npm run build` before completing work

## Security defaults

- Do not weaken CSP in `next.config.ts` or SSRF rules in `lib/security/`
- Set `DATA_API_KEY` in production for API routes
- Set `DB_CONNECT_ALLOWED_HOSTS` when exposing DB connect publicly
- Dependency audit: `npm audit --omit=dev`; overrides in `package.json` for `valibot`, `tmp`
- Liam CLI: pasted schema is validated/sanitized (postgres); no DB credentials in ERD pipeline

## Common commands

```bash
npm run dev          # local dev
npm test             # unit tests
npm run build        # production build
npm run docker:app   # app + postgres in Docker
npm run db:migrate   # manual migrations
```

## Related

- [AGENTS.md](../../../AGENTS.md) — full project guide
- [DOCKER.md](../../../DOCKER.md) — container troubleshooting
- [docs/db-agent-security.md](../../../docs/db-agent-security.md) — dependency security
