#!/bin/sh
set -e
cd /app
exec su-exec nextjs:nodejs node server.js
