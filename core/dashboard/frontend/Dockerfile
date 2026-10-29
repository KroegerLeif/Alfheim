# Stage 1: Dependencies
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.28.5 --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared ./packages/shared
COPY core/dashboard/frontend/package.json ./core/dashboard/frontend/

# Use BuildKit pnpm store cache mount so downloaded packages are reused across rebuilds.
# The shared cache id=pnpm is intentionally shared with other frontend builds in this monorepo.
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

# Stage 2: Builder
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.28.5 --activate

COPY --from=deps /app ./
COPY core/dashboard/frontend ./core/dashboard/frontend

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_OIDC_ISSUER
ENV NEXT_PUBLIC_OIDC_ISSUER=$NEXT_PUBLIC_OIDC_ISSUER
ARG NEXT_PUBLIC_OIDC_CLIENT_ID
ENV NEXT_PUBLIC_OIDC_CLIENT_ID=$NEXT_PUBLIC_OIDC_CLIENT_ID
ARG NEXT_PUBLIC_OIDC_REDIRECT_URI
ENV NEXT_PUBLIC_OIDC_REDIRECT_URI=$NEXT_PUBLIC_OIDC_REDIRECT_URI
ARG NEXT_PUBLIC_FRONTEND_URL
ENV NEXT_PUBLIC_FRONTEND_URL=$NEXT_PUBLIC_FRONTEND_URL

WORKDIR /app/core/dashboard/frontend
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

COPY --from=builder /app/core/dashboard/frontend/public ./core/dashboard/frontend/public
COPY --from=builder --chown=nextjs:nodejs /app/core/dashboard/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/core/dashboard/frontend/.next/static ./core/dashboard/frontend/.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "core/dashboard/frontend/server.js"]
