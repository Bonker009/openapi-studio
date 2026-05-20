#!/bin/sh
set -e

DATA="${DATA_DIR:-/app/data}"
mkdir -p "$DATA"

# Bind mounts (especially Docker Desktop on Windows) are often not writable by uid 1001.
chmod 777 "$DATA" 2>/dev/null || true
chown -R nextjs:nodejs "$DATA" 2>/dev/null || true
chmod 666 "$DATA"/*.db "$DATA"/*.db-* 2>/dev/null || true

cd /app
exec su-exec nextjs:nodejs node server.js
