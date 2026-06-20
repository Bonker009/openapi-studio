<div align="center">

# 🔱 Poseidon

**Your OpenAPI command center — spec management, interactive playground, AI assistant, test suites, flow diagrams, ER diagrams, and semantic diff in one app.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-Private-lightgrey)](#)

</div>

---

## What Is Poseidon?

Poseidon turns your OpenAPI specs into a living workspace. Upload a spec once and immediately get:

- **Browsable docs** — endpoints grouped by controller with working-status tracking and inline notes
- **Interactive playground** — fire real requests through a server-side proxy (SSRF-safe, no CORS pain)
- **AI assistant** — ask questions about your API *and* your database in natural language
- **Validation suites** — auto-generate and run test cases per endpoint
- **Flow builder** — design and execute multi-step API sequences with conditional branching
- **Spec diff** — compare any two versions with breaking / non-breaking / additive classification
- **ER diagrams** — paste a Postgres / Prisma / Drizzle schema and get an interactive ERD instantly
- **Excel export** — one-click download of your endpoint table as a styled workbook

---

## Architecture

```
app/                    Next.js 16 App Router (pages + API routes)
src/
├── features/           UI feature modules (AI chat, DB browse, playground hooks)
├── domain/             Framework-independent business logic
├── infrastructure/     Postgres repositories, LLM services, proxy handlers
└── shared/             Pure utilities, error types, shared UI primitives
components/             shadcn/ui components + feature UI
lib/                    Compatibility re-exports, playground HTTP, security helpers
drizzle/pg/             Postgres SQL migrations
scripts/                DB migration runner, Docker staging helpers
```

```mermaid
flowchart TD
  pages[app/pages] --> features[src/features]
  features --> domain[src/domain]
  apiRoutes[app/api routes] --> infrastructure[src/infrastructure]
  infrastructure --> domain
  domain --> shared[src/shared]
```

### Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router, `output: "standalone"`, Turbopack in dev) |
| **Language** | TypeScript (strict) |
| **UI** | React 19 · Tailwind CSS 4 · shadcn/ui (Radix, "new-york", slate) |
| **Database** | PostgreSQL via `pg` · Drizzle ORM + drizzle-kit |
| **AI** | Vercel AI SDK · OpenAI · Groq · LangGraph |
| **Forms** | Zod · react-hook-form |
| **Tables** | TanStack Table |
| **Editor** | CodeMirror 6 (JSON, SQL, JS) |
| **Diagrams** | XYFlow + ELKjs (flows) · `@liam-hq/cli` (ER diagrams) |
| **Export** | ExcelJS |
| **Testing** | Node built-in test runner via `tsx --test` |

---

## Routes

| Path | Purpose |
|---|---|
| `/` | Spec list — upload, search, delete |
| `/documentation/[id]` | Endpoint table with status + notes |
| `/documentation/[id]/playground` | Interactive request runner |
| `/documentation/[id]/playground/flows` | Multi-step flow builder |
| `/documentation/[id]/history` | Version history + semantic diff |
| `/documentation/[id]/erd` | ER diagram (paste schema or live DB) |
| `API: /api/data/*` | Spec CRUD, flows, history |
| `API: /api/ai/chat` | Unified AI chat (SSE stream) |
| `API: /api/db/*` | DB connections, schema, browse, ERD build |
| `API: /api/playground/*` | SSRF-safe proxy, OAuth token |

---

## Quick Start

### Prerequisites

- Node.js 20+ and npm
- PostgreSQL 16+ (or Docker)

### 1 — Clone

```bash
git clone https://github.com/Bonker009/openapi-studio.git
cd openapi-studio
```

### 2 — Install

```bash
npm install
```

### 3 — Configure

```bash
cp .env.local.example .env
# Edit .env — set DATABASE_URL at minimum
```

### 4 — Start Postgres (skip if you have Postgres running)

```bash
npm run docker:db
# Postgres on localhost:15432, DATABASE_URL: postgresql://app:app@127.0.0.1:15432/flows
```

### 5 — Migrate and Run

```bash
npm run db:migrate
npm run dev
```

Open **http://localhost:3000**.

---

## Docker

### Full stack (app + Postgres)

```bash
cp .env.local.example .env
docker compose -f docker-compose.db.yml -f docker-compose.postgres.yml up -d --build
```

### Postgres only (dev on host)

```bash
npm run docker:db
```

Published image: `seyha2023/list-endpoints-app:latest`

See [DOCKER.md](DOCKER.md) for host-network setups, Ventro proxy, and troubleshooting.

---

## Environment Variables

### Required

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |

### App

| Variable | Default | Description |
|---|---|---|
| `INTERNAL_APP_URL` | — | Set to `http://127.0.0.1:3000` inside Docker for server-side self-fetches |
| `NODE_OPTIONS` | — | Set `--dns-result-order=ipv4first` in Docker (Alpine IPv6 fix) |

### AI (optional)

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | Enables OpenAI models + embeddings for RAG indexing |
| `OPENAI_CHAT_MODEL` / `OPENAI_CHAT_MODELS` | Default model / selectable model list in the UI |
| `GROQ_API_KEY` | Enables Groq models (Llama 3.3 70B by default) |
| `GROQ_CHAT_MODEL` / `GROQ_CHAT_MODELS` | Default model / selectable model list |
| `AI_CHAT_DEFAULT_PROVIDER` | `openai` or `groq` when both are configured |
| `ENABLE_AI` | Set `false` to disable all AI routes |
| `OLLAMA_HOST` | Local Ollama endpoint for test-case generation |
| `ENABLE_LLAMA_GENERATE` | Set `false` to disable `/api/llama-generate` |

### Database Agent (optional)

| Variable | Description |
|---|---|
| `DB_CREDENTIALS_ENCRYPTION_KEY` | Secret for encrypting user Postgres passwords at rest |
| `DB_CONNECT_ALLOWED_HOSTS` | Comma-separated host allowlist for user DB connections |
| `DB_AGENT_ENABLED` | Set `false` to disable `/api/db/*` |
| `DB_URL` / `DB_USERNAME` / `DB_PASSWORD` | Pre-fill the Connect PostgreSQL dialog |

### ER Diagrams

| Variable | Default | Description |
|---|---|---|
| `LIAM_ERD_CACHE_DIR` | `/tmp/liam-erd-cache` | Writable directory for cached ERD builds |
| `LIAM_ERD_ENABLED` | `true` | Set `false` to disable ERD routes |
| `LIAM_ERD_MAX_TABLES` | `500` | Max tables per ERD build |
| `LIAM_ERD_BUILD_TIMEOUT_MS` | `120000` | Kill Liam CLI after this many ms |

---

## Development Commands

| Command | Description |
|---|---|
| `npm run dev` | Dev server with Turbopack |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (`tsx --test`) |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate` | Run Postgres migrations |
| `npm run docker:db` | Start local Postgres container |
| `npm run docker:app` | Build and run full stack in Docker |

Migrations also run automatically on server startup via `instrumentation.ts`.

---

## AI Assistant

Poseidon includes a unified AI chat interface that can answer questions about both your **API spec** and a **connected database**.

**Three-phase pipeline** (no keyword router — the model picks tools from context):

1. **RAG query rewrite** — rewrites the user question into an optimised retrieval query
2. **Tool loop** — `generateText` with tools: `search_api_docs`, `list_api_endpoints`, `search_db_schema`, `list_db_tables`, `get_table_schema`, `execute_readonly_sql`
3. **Answer stream** — `streamText` synthesis prompt from tool evidence

Models are selectable in the UI. Multi-model routing lives in `src/domain/ai/model-task-routing.ts`.

---

## Security

- **API auth:** `DATA_API_KEY` header or same-origin browser requests (`lib/security/route-auth.ts`)
- **CSP / headers:** configured in `next.config.ts` — do not weaken
- **SSRF:** playground proxy enforces server-side allowlists (`lib/security/`)
- **SQL:** host allowlist (`DB_CONNECT_ALLOWED_HOSTS`) + AST-level read-only gate (`sanitizeReadOnlySql`)
- **Secrets:** DB credentials encrypted at rest with `DB_CREDENTIALS_ENCRYPTION_KEY`

See [`docs/db-agent-security.md`](docs/db-agent-security.md) for the full security model.

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Run `npm test` and `npm run build` before pushing
4. Open a pull request

**For AI changes** — edit prompt modules in `src/domain/ai/prompts/`, not ad-hoc strings in routes.  
**For schema changes** — edit `src/infrastructure/database/pg-flow-schema.ts`, then run `npm run db:generate`.

See [AGENTS.md](AGENTS.md) for AI-agent coding conventions and pitfalls.

---

## License

Private project. All rights reserved.
