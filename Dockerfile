# syntax=docker/dockerfile:1

FROM node:24-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM builder AS externals
RUN mkdir -p /opt/externals \
  && cd /app/node_modules \
  && for pkg in pg pg-pool pg-protocol pg-types pg-connection-string pg-int8 postgres-array postgres-bytea postgres-date postgres-interval xtend; do \
       if [ -d "$pkg" ]; then cp -a "$pkg" "/opt/externals/$pkg"; fi; \
     done

FROM node:24-alpine AS runner
RUN apk add --no-cache su-exec
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NODE_OPTIONS=--dns-result-order=ipv4first
ENV INTERNAL_APP_URL=http://127.0.0.1:3000

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/drizzle/pg ./drizzle/pg
COPY --from=externals --chown=nextjs:nodejs /opt/externals/ ./node_modules/

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
