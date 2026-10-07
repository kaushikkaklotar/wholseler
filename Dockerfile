FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci
COPY . .
# Same container: browser -> Next rewrite -> loopback-only API. No secrets at build.
ENV API_INTERNAL_URL=http://127.0.0.1:3001 NEXT_TELEMETRY_DISABLED=1
RUN npm run db:generate && npm run build
RUN mkdir -p apps/web/public apps/web/.next/standalone/apps/web/.next && cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static && cp -r apps/web/public apps/web/.next/standalone/apps/web/public && rm -rf apps/web/.next/cache

FROM node:24-bookworm-slim AS production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=node:node /app /app
ENV NODE_ENV=production WEB_HOST=0.0.0.0 WEB_STANDALONE=true API_PORT=3001 WEB_PORT=3000 NEXT_TELEMETRY_DISABLED=1
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=12s --start-period=60s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/v1/health',{signal:AbortSignal.timeout(10000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "scripts/dev.mjs", "--production"]
