# Docker Setup

This project includes Docker configuration for easy deployment.

## Prerequisites

- Docker (version 20.10 or higher)
- Docker Compose (version 2.0 or higher)

## Quick Start

### Build and run with Docker Compose

```bash
# Build and start the container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down
```

### Build and run with Docker only

```bash
# Build the image
docker build -t list-endpoints-app .

# Run the container
docker run -p 3000:3000 -v $(pwd)/data:/app/data list-endpoints-app
```

## Accessing the Application

Once the container is running, access the application at:
- **URL**: http://localhost:3000

## Data Persistence

The `data` directory is mounted as a volume to persist:
- **SQLite database** (`data/app.db`) — specs, version history, endpoint statuses, and settings
- Legacy JSON files under `data/specs/`, `data/status/`, and `data/settings/` (optional backup; import with `npm run db:import`)

Migrations run automatically on server startup. For a fresh install with existing JSON only, run `npm run db:import` once inside the container or on the host before starting.

## Environment Variables

You can customize the application by setting environment variables in `docker-compose.yml`:

```yaml
environment:
  - NODE_ENV=production
  - NEXT_TELEMETRY_DISABLED=1
  # Add your custom variables here
```

## Troubleshooting

### `fetch failed` / `ECONNREFUSED` in logs or "Server Components render" error in the browser

Node often resolves `localhost` to IPv6 (`::1`) first. In minimal Docker images the app may only accept IPv4 (`127.0.0.1`), which produces `ECONNREFUSED` and an `AggregateError` when Next.js performs internal same-origin fetches.

This repo sets IPv4-first DNS via `NODE_OPTIONS=--dns-result-order=ipv4first` in Compose/Dockerfile and [`instrumentation.ts`](instrumentation.ts). Server-side API calls use `INTERNAL_APP_URL=http://127.0.0.1:3000` (see [`lib/request-base-url.ts`](lib/request-base-url.ts)).

After changing these settings, rebuild the image:

```bash
docker compose up -d --build
```

The Compose **healthcheck** uses `http://127.0.0.1:3000/` (not `localhost`).

### Container won't start
- Check logs: `docker-compose logs`
- Verify port 3000 is not in use: `lsof -i :3000` (macOS/Linux) or `netstat -ano | findstr :3000` (Windows)

### Build fails
- Ensure you have enough disk space
- Clear Docker cache: `docker system prune -a`
- Rebuild without cache: `docker-compose build --no-cache`

### `SQLITE_IOERR_SHMOPEN` / disk I/O error on startup

SQLite **WAL mode** creates `-wal` / `-shm` files that often break on Docker **bind-mounted** folders (common on Windows). Compose sets `SQLITE_JOURNAL_MODE=DELETE` to avoid that.

If errors persist after upgrading, stop the container and remove stale sidecars (keep `app.db`):

```bash
rm -f data/app.db-wal data/app.db-shm
docker compose up -d --build
```

### `ERR_DLOPEN_FAILED` / `better_sqlite3.node: symbol not found`
The native SQLite module was compiled for a different Node.js version than the one running the container. All Dockerfile stages use the same Node image (e.g. `node:24-alpine`). Rebuild without cache:

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

### `SQLITE_CANTOPEN` / unable to open database file

The app user must be able to write to `./data` on the mounted volume. The image entrypoint creates `/app/data` and fixes permissions before starting Node.

Rebuild and restart:

```bash
docker compose down
docker compose up -d --build
```

On Windows, ensure the host `data` folder exists: `mkdir -p data`. If problems persist, remove stale DB locks: `rm -f data/app.db-wal data/app.db-shm`.

### Data not persisting
- Ensure the `data` directory exists and has proper permissions
- Check volume mount in `docker-compose.yml`

## Production Deployment

For production deployment:

1. Update environment variables in `docker-compose.yml`
2. Use a reverse proxy (nginx, Traefik) in front of the container
3. Set up proper SSL/TLS certificates
4. Configure logging and monitoring
5. Use Docker secrets for sensitive data

## Commands Reference

```bash
# Build image
docker-compose build

# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f web

# Restart services
docker-compose restart

# Execute command in container
docker-compose exec web sh

# Remove everything (including volumes)
docker-compose down -v
```

