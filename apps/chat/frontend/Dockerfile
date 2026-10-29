# Stage 1: Dependencies
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.34.6 --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared ./packages/shared
COPY apps/chat/frontend/package.json ./apps/chat/frontend/

# Use BuildKit pnpm store cache mount so downloaded packages are reused across rebuilds.
# The shared cache id=pnpm is intentionally shared with other frontend builds in this monorepo.
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

# Stage 2: Builder
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.34.6 --activate

COPY --from=deps /app ./
COPY apps/chat/frontend ./apps/chat/frontend

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_OIDC_ISSUER
ENV NEXT_PUBLIC_OIDC_ISSUER=$NEXT_PUBLIC_OIDC_ISSUER
ARG NEXT_PUBLIC_OIDC_CLIENT_ID
ENV NEXT_PUBLIC_OIDC_CLIENT_ID=$NEXT_PUBLIC_OIDC_CLIENT_ID
ARG NEXT_PUBLIC_FRONTEND_URL
ENV NEXT_PUBLIC_FRONTEND_URL=$NEXT_PUBLIC_FRONTEND_URL

WORKDIR /app/apps/chat/frontend
RUN pnpm run build

# Stage 3: Runner
FROM node:22-alpine AS runner
# The runner only executes node; drop npm/npx/corepack/yarn so their bundled deps do not trip the image scan.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /opt/yarn* /usr/local/bin/yarn /usr/local/bin/yarnpkg
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/chat/frontend/public ./apps/chat/frontend/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/chat/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/chat/frontend/.next/static ./apps/chat/frontend/.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "apps/chat/frontend/server.js"]
