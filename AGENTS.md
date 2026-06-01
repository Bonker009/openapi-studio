# AGENTS.md

Guidance for AI agents working in this repository.

## Project overview

- **Name:** `api_feedback` (package name)
- **Version:** 0.3.0
- **Type:** Next.js 16 App Router application
- **Purpose:** OpenAPI spec management, endpoint documentation, API playground/proxy, test cases, validation suites, flow diagrams, spec diff/history, and Excel export

## Tech stack

| Layer | Technology |
|-------|------------|
| Language | TypeScript (strict) |
| Framework | Next.js 16 (`output: "standalone"`, Turbopack in dev) |
| UI | React 19, Tailwind CSS 4, shadcn/ui (Radix, "new-york" style, slate base) |
| Database | PostgreSQL via `pg`, Drizzle ORM + drizzle-kit |
| Forms / validation | Zod, react-hook-form |
| Other | TanStack Table, CodeMirror, XYFlow + ELKjs, ExcelJS, react-markdown, Sonner |
| Testing | Node built-in test runner via `tsx --test` (no Jest/Vitest) |
| Linting | ESLint 9 with `eslint-config-next` |

Package manager: use **npm** and `package-lock.json` as canonical (`package.json` scripts). `bun.lock` may exist but is secondary.

## Project structure

```
app/              Next.js App Router (pages, layouts, API routes under app/api/)
src/
  features/       Feature hooks and UI modules (specs, playground, documentation)
  domain/         Framework-independent logic (openapi, diff, export, validation, flows)
  infrastructure/ Repositories, LLM services, proxy handlers, DB adapters
  shared/         Pure utilities, AppError/Result, error boundaries
components/       Legacy/feature UI + ui/ (shadcn primitives)
lib/              Compatibility re-exports to src/domain + playground HTTP, security
drizzle/pg/       Postgres SQL migrations and meta snapshots
scripts/          DB migration runner
hooks/            Shared React hooks (use-mobile)
public/           Static assets
```

**Routing (high level):**

- Home: `app/page.tsx`
- Documentation: `app/documentation/` (per-spec `[id]`, playground, flows, history)
- API: `app/api/data/*`, `app/api/playground/*`, `app/api/llama-generate/`

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server (Turbopack); requires `DATABASE_URL` in `.env` |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (`tsx --test`; see `test` script in `package.json`) |
| `npm run db:generate` | Generate Postgres Drizzle migrations (`drizzle.pg.config.ts`) |
| `npm run db:migrate` | Run Postgres migrations manually |
| `npm run docker:db` | Start local Postgres container (`docker-compose.db.yml`) |
| `npm run docker:app` | Build/run app + Postgres via Compose |

Migrations run automatically on server startup via `instrumentation.ts`.

## Conventions

- **Path aliases:** `@/*` → project root; `@/domain/*`, `@/features/*`, `@/shared/*`, `@/infrastructure/*` → `src/` layers (`tsconfig.json`)
- **Flow engine:** `src/domain/flows/` (orchestration, extraction, assertions); UI helpers in `src/features/flow/`; `lib/flows/` re-exports during migration
- **shadcn aliases:** `@/components`, `@/components/ui`, `@/lib`, `@/hooks`
- **File naming:** kebab-case for routes, libs, and most components; PascalCase for some panels (e.g. `TestCaseGeneratorPanel.tsx`)
- **Tests:** Co-located as `*.test.ts` next to source in `lib/`; paths are listed explicitly in the `test` script in `package.json`
- **API routes:** `app/api/<resource>/route.ts`
- **Design:** Follow `style.md` for typography, colors, and spacing
- **Data:** All persistence in PostgreSQL (`DATABASE_URL`). Schema in `src/infrastructure/database/pg-flow-schema.ts`; migrations in `drizzle/pg/`

## Docker

- **Dockerfile:** Multi-stage `node:24-alpine` build (deps → builder → runner)
- **Compose:** `docker-compose.db.yml` (Postgres only) or `docker-compose.db.yml` + `docker-compose.postgres.yml` (app + Postgres)
- **Runtime user:** non-root `nextjs` (uid 1001); entrypoint: `docker-entrypoint.sh`
- **Required env:**
  - `DATABASE_URL` — PostgreSQL connection string
  - `NODE_OPTIONS=--dns-result-order=ipv4first`
  - `INTERNAL_APP_URL=http://127.0.0.1:3000` (server-side fetches)

**Local dev with Docker Postgres:**

```bash
npm run docker:db
cp .env.local.example .env
npm run db:migrate
npm run dev
```

**Published image (Docker Hub):** `seyha2023/list-endpoints-app:latest` / `:0.3.0`

See `DOCKER.md` for troubleshooting (IPv6/localhost, Postgres connectivity).

## Agent notes / pitfalls

- **Do not edit** generated migration SQL casually; use `db:generate` after schema changes in `pg-flow-schema.ts`.
- **`package-lock.json`** must stay in sync with `package.json`. Run `npm install` after dependency changes; Docker `npm ci` fails if the lockfile is out of sync.
- **Security:** CSP and headers live in `next.config.ts`; do not weaken them. Outbound/SSRF policies are in `lib/security/` — do not bypass.
- **Internal fetches:** Server-side code should use `INTERNAL_APP_URL` / `lib/request-base-url.ts`; avoid relying on `localhost` resolving to IPv6 in Alpine.
- **Scope:** Prefer minimal, focused changes; match existing patterns in the nearest feature folder before introducing new abstractions.

## Related docs

- `DOCKER.md` — container deployment and troubleshooting
- `style.md` — UI/design guidelines
- `components.json` — shadcn configuration
