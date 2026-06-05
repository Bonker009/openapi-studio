# Docker Setup

## Prerequisites

- Docker 20.10+
- Docker Compose v2

## Quick start (app + Postgres)

```bash
cp .env.local.example .env
docker compose -f docker-compose.db.yml -f docker-compose.postgres.yml up -d --build
```

Open http://localhost:3000

Postgres is exposed on host port **15432** when using `docker-compose.db.yml`.

## Postgres only (dev on host)

```bash
npm run docker:db
export DATABASE_URL=postgresql://app:app@127.0.0.1:15432/flows
npm run db:migrate
npm run dev
```

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `INTERNAL_APP_URL` | Recommended in Docker | `http://127.0.0.1:3000` for server-side fetches |
| `NODE_OPTIONS` | Set in Compose | `--dns-result-order=ipv4first` |
| `OPENAI_API_KEY` | For indexing + optional chat | Required for embeddings/indexing; also enables OpenAI chat models |
| `GROQ_API_KEY` | Optional chat | Enables Groq chat models in Ask Docs (selectable in UI) |
| `OPENAI_CHAT_MODEL` / `GROQ_CHAT_MODEL` | Optional | Default model per provider |
| `OPENAI_CHAT_MODELS` / `GROQ_CHAT_MODELS` | Optional | Comma-separated model list for the UI selector |
| `AI_CHAT_DEFAULT_PROVIDER` | Optional | `openai` or `groq` when both are configured |
| `ENABLE_AI` | Optional | Set to `false` to disable AI routes |
| `DB_CREDENTIALS_ENCRYPTION_KEY` | For DB connect | Secret for encrypting user Postgres passwords at rest |
| `DB_AGENT_ENABLED` | Optional | Set to `false` to disable `/api/db/*` |
| `DB_CONNECT_ALLOWED_HOSTS` | Optional | Comma-separated host allowlist for user DB connections |
| `DB_URL` / `DB_USERNAME` / `DB_PASSWORD` | Optional | Pre-fill **Connect PostgreSQL** (`jdbc:postgresql://…` supported). In Docker, `localhost` in `DB_URL` is rewritten to `host.docker.internal`. |
| `DB_CONNECT_EXPOSE_DEFAULTS` | Optional | Set `true` to return password from `/api/db/defaults` when `NODE_ENV=production` (e.g. local Docker) |
| `DB_QUERY_MAX_ROWS` / `DB_INDEX_SAMPLE_ROWS` | Optional | Low-memory limits for agent queries and indexing |

The `web` service loads `.env` via `env_file` and passes AI variables into the container. After changing `.env`, restart:

```bash
docker compose -f docker-compose.db.yml -f docker-compose.postgres.yml up -d --build
```

## Troubleshooting

### `fetch failed` / `ECONNREFUSED` (internal fetches)

Use `INTERNAL_APP_URL=http://127.0.0.1:3000` and `NODE_OPTIONS=--dns-result-order=ipv4first`. Rebuild after env changes:

```bash
docker compose -f docker-compose.db.yml -f docker-compose.postgres.yml up -d --build
```

### Database migration failed on startup

Run migrations manually:

```bash
npm run db:migrate
```

Ensure `DATABASE_URL` points at a running Postgres instance.

### Docker cannot use `localhost` or your LAN IP for host Postgres

From inside a **bridge** container:

| You enter | What it really means | Works for Ventro on `127.0.0.1:5432`? |
|-----------|----------------------|----------------------------------------|
| `localhost` / `127.0.0.1` | The **container itself**, not your PC | No |
| `192.168.x.x` (LAN IP) | Your PC, but Postgres only listens on loopback | No (unless you change Postgres `listen_addresses`) |
| `host.docker.internal` | Docker host (`172.17.0.1`) | No if Postgres is `127.0.0.1` only |

Your `ss` output shows Ventro on **`127.0.0.1:5432`** and the app DB on **`0.0.0.0:15432`** — different services.

**Option A — host DB proxy (recommended for `docker compose up web`):**

Forwards host `127.0.0.1:5432` → `0.0.0.0:15433` so containers can connect.

```bash
# .env: DB_CONNECT_DOCKER_PROXY_PORT=15433  (already in .env.example)
npm run docker:app:ventro
```

Connect dialog pre-fills **`host.docker.internal:15433`** / `ventro`. Open http://localhost:3000

**Option B — host network:**

```bash
# .env: DB_CONNECT_DOCKER_HOST_REWRITE=false, remove or comment DB_CONNECT_DOCKER_PROXY_PORT
npm run docker:app:host
```

Open http://127.0.0.1:3000 — then `127.0.0.1:5432` works like on the host.

**Option C — open Postgres to Docker/LAN** (`postgresql.conf` + `pg_hba.conf` for `172.17.0.0/16` or your LAN).

**Option D — run on the host:** `npm run dev` and `127.0.0.1:5432`.

### Port 15432 already in use

Change the host port in `docker-compose.db.yml` (e.g. `15433:5432`) and update `DATABASE_URL`.

### `DATABASE_URL` not set

The app requires Postgres. Set `DATABASE_URL` in `.env` or Compose `environment`.

## Commands

```bash
# Postgres container
docker compose -f docker-compose.db.yml up -d
docker compose -f docker-compose.db.yml down

# App + Postgres
docker compose -f docker-compose.db.yml -f docker-compose.postgres.yml up -d --build
docker compose -f docker-compose.db.yml -f docker-compose.postgres.yml logs -f web
```
