# AGENTS.md

Guidance for AI agents working in this repository.

## Project overview

- **Name:** `api_feedback` (package name)
- **Version:** 0.3.0
- **Type:** Next.js 16 App Router application
- **Purpose:** OpenAPI spec management, endpoint documentation, API playground/proxy, unified AI chat (API + database), test cases, validation suites, flow diagrams, ER diagrams, spec diff/history, and Excel export

Package manager: use **npm** and `package-lock.json` as canonical (`package.json` scripts). `bun.lock` may exist but is secondary.

## Tech stack

| Layer | Technology |
|-------|------------|
| Language | TypeScript (strict) |
| Framework | Next.js 16 (`output: "standalone"`, Turbopack in dev) |
| UI | React 19, Tailwind CSS 4, shadcn/ui (Radix, "new-york" style, slate base) |
| Database | PostgreSQL via `pg`, Drizzle ORM + drizzle-kit |
| AI | Vercel AI SDK (`ai`), `@ai-sdk/openai`, `@ai-sdk/groq`, LangGraph (legacy DB agent) |
| Forms / validation | Zod, react-hook-form |
| Other | TanStack Table, CodeMirror, XYFlow + ELKjs, ExcelJS, react-markdown, Sonner, `@liam-hq/cli` (ERD) |
| Testing | Node built-in test runner via `tsx --test` (no Jest/Vitest) |
| Linting | ESLint 9 with `eslint-config-next` |

## Project structure

```
app/              Next.js App Router (pages, layouts, API routes under app/api/)
src/
  features/       Feature orchestration (AI chat, DB browse, playground hooks)
  domain/         Framework-independent logic (openapi, diff, AI prompts, flows, db)
  infrastructure/ Repositories, LLM services, proxy handlers, DB adapters, tools
  shared/         Pure utilities, AppError/Result, error boundaries
components/       Feature UI + ui/ (shadcn primitives)
lib/              Compatibility re-exports + playground HTTP, security helpers
drizzle/pg/       Postgres SQL migrations and meta snapshots
scripts/          DB migration runner, Docker staging (e.g. stage-liam-cli-deps.mjs)
hooks/            Shared React hooks
.cursor/skills/   Project Cursor skill (list-endpoints)
public/           Static assets
```

## Routing

| Path | Purpose |
|------|---------|
| `/` | Spec list / home |
| `/documentation/[id]` | Endpoint docs table |
| `/documentation/[id]/playground` | API playground |
| `/documentation/[id]/playground/flows` | Flow test builder |
| `/documentation/[id]/history` | Spec version history |
| `/documentation/[id]/erd` | ER diagram — paste schema (Postgres / Prisma / Drizzle) |
| `/documentation/[id]/erd/[cacheKey]` | Full-page ERD viewer redirect |
| `/api/data/*` | Spec CRUD, flows, history |
| `/api/ai/chat` | Unified AI chat (SSE) |
| `/api/ai/question` | Legacy chat (delegates to unified service) |
| `/api/ai/config` | Provider catalog + task models |
| `/api/ai/index-openapi`, `/api/ai/flow` | RAG index, flow generation |
| `/api/db/*` | Connections, schema, browse, values, ERD build |
| `/api/db/erd/build` | Paste-schema ERD build (no connection) |
| `/api/db/erd/[specId]/[cacheKey]/*` | Paste-schema ERD static assets |
| `/api/playground/*` | Proxy, OAuth token |

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server (Turbopack); requires `DATABASE_URL` in `.env` |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (`tsx --test`; paths in `package.json` `test` script) |
| `npm run db:generate` | Generate Postgres Drizzle migrations |
| `npm run db:migrate` | Run Postgres migrations manually |
| `npm run docker:db` | Start local Postgres container |
| `npm run docker:app` | Build/run app + Postgres via Compose |

Migrations run automatically on server startup via `instrumentation.ts`.

## Unified AI chat architecture

Entry: [`src/features/ai/unified-assistant-service.ts`](src/features/ai/unified-assistant-service.ts)

Three-phase agent (no keyword router — model picks tools from history):

1. **Optional `rag_query` rewrite** — `AI_RAG_QUERY_PROVIDER` / `AI_RAG_QUERY_MODEL`
2. **`tool_loop`** — `generateText` + tools from [`unified-assistant-tools.ts`](src/infrastructure/ai/unified-assistant-tools.ts), `UNIFIED_AGENT_MAX_STEPS`
3. **`answer` stream** — `streamText` with synthesis prompt; model from UI selection

Tools (when DB connected): `search_api_docs`, `list_api_endpoints`, `search_db_schema`, `list_db_tables`, `get_table_schema`, `execute_readonly_sql`.

Client: [`components/ai/stream-unified-chat-client.ts`](components/ai/stream-unified-chat-client.ts) → `POST /api/ai/chat`. UI: [`components/ai/ai-assistant-content.tsx`](components/ai/ai-assistant-content.tsx) (Chat tab).

Multi-model routing: [`src/domain/ai/model-task-routing.ts`](src/domain/ai/model-task-routing.ts).

## Prompt system

Layered modules in [`src/domain/ai/prompts/`](src/domain/ai/prompts/):

| File | Task |
|------|------|
| `prompt-sections.ts` | Shared blocks (grounding, citations, tool results); `PROMPT_VERSION` |
| `rag-query-rewrite-prompt.ts` | Retrieval query rewrite |
| `tool-loop-system-prompt.ts` | Tool-selection system prompt |
| `answer-synthesis-prompt.ts` | Final answer from tool evidence |
| `unified-assistant-system.ts` | Answer-stream system prompt |

**Conventions:** Compose prompts from section builders; do not add 200-line inline strings. Bump `PROMPT_VERSION` when behavior changes materially. See [`.cursor/skills/list-endpoints/prompts.md`](.cursor/skills/list-endpoints/prompts.md).

## Database and ER diagram

- **Connections:** per `specId`; encrypted credentials; read-only by default
- **Schema snapshots:** `db_schema_snapshots` via introspect/index
- **Agent SQL:** no forced small `LIMIT` when `AI_DB_QUERY_INJECT_LIMIT=false`; byte cap + timeout apply
- **ERD (paste):** [`src/domain/db/erd-paste-schema.ts`](src/domain/db/erd-paste-schema.ts) validates pasted schema; [`ensureErdBuildFromPaste`](src/features/db/liam-erd-service.ts) spawns Liam CLI with matching `--format`
- **ERD (legacy connection API):** snapshot → DDL via [`snapshotToPgsqlDdl`](src/domain/db/snapshot-to-pgsql.ts); cache under `LIAM_ERD_CACHE_DIR/{connectionId}/`
- **ERD paste cache:** `LIAM_ERD_CACHE_DIR/paste/{specId}/{cacheKey}/` where `cacheKey = hash(format + content)`
- **ERD security:** [`src/domain/db/erd-security.ts`](src/domain/db/erd-security.ts) — asset allowlist, table cap, DDL byte cap, build timeout

All `/api/db/*` routes: `guardDbRoute` + `validateSpecId` + `findForSpec` where applicable.

## Security

- **API auth:** `DATA_API_KEY` or same-origin browser requests (`lib/security/route-auth.ts`)
- **CSP / headers:** [`next.config.ts`](next.config.ts) — do not weaken
- **SSRF:** playground proxy policies in `lib/security/` — do not bypass
- **DB:** host allowlist (`DB_CONNECT_ALLOWED_HOSTS`), SQL AST gate (`sanitizeReadOnlySql`)
- **Dependencies:** overrides for `valibot`, `tmp`; run `npm audit --omit=dev` before releases
- **Docs:** [`docs/db-agent-security.md`](docs/db-agent-security.md)

## Docker

- **Dockerfile:** Multi-stage `node:24-alpine` (deps → builder → externals → runner)
- **Externals stage:** copies `pg` family + **full `@liam-hq/cli` dep tree** via [`scripts/stage-liam-cli-deps.mjs`](scripts/stage-liam-cli-deps.mjs) (standalone trace misses subprocess deps like `commander`)
- **Runtime user:** non-root `nextjs` (uid 1001)
- **Required env:** `DATABASE_URL`, `INTERNAL_APP_URL=http://127.0.0.1:3000`, `NODE_OPTIONS=--dns-result-order=ipv4first`
- **ERD:** writable `LIAM_ERD_CACHE_DIR` (default `/tmp/liam-erd-cache`)

See [`DOCKER.md`](DOCKER.md) for troubleshooting (Postgres connectivity, Liam `commander` error).

## Conventions

- **Path aliases:** `@/*` → project root; `@/domain/*`, `@/features/*`, `@/infrastructure/*` → `src/`
- **Flow engine:** `src/domain/flows/`; UI in `src/features/flow/`
- **Tests:** list every new `*.test.ts` in `package.json` `test` script
- **API routes:** `app/api/<resource>/route.ts`
- **Design:** Follow `style.md`
- **Schema changes:** edit `pg-flow-schema.ts` → `npm run db:generate` — do not hand-edit generated migration SQL casually

## Agent workflow

1. Read the nearest feature folder before adding abstractions
2. Keep diffs minimal; match existing naming and import style
3. Run `npm test` and `npm run build` before finishing
4. For AI changes: edit prompt modules, not ad-hoc strings in routes
5. For DB features: always use `guardDbRoute` and snapshot-backed schema reads for ERD
6. Do not add keyword/intent routers for chat — use the tool loop

## Agent pitfalls

- **`package-lock.json`** must stay in sync; Docker `npm ci` fails if out of sync
- **Internal fetches:** use `INTERNAL_APP_URL` / `lib/request-base-url.ts` (Alpine IPv6)
- **Liam ERD in Docker:** subprocess needs staged CLI deps; rebuilding image runs `stage-liam-cli-deps.mjs`
- **Scope:** prefer focused changes over cross-cutting refactors unless requested

## Related docs

- [`DOCKER.md`](DOCKER.md) — deployment and troubleshooting
- [`style.md`](style.md) — UI/design guidelines
- [`docs/db-agent-security.md`](docs/db-agent-security.md) — LangChain / dependency security
- [`.cursor/skills/list-endpoints/SKILL.md`](.cursor/skills/list-endpoints/SKILL.md) — project Cursor skill
