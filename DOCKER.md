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
