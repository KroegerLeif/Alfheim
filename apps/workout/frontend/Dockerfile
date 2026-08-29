# Stage 1: Dependencies
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared ./packages/shared
COPY apps/workout/frontend/package.json ./apps/workout/frontend/

# Use BuildKit pnpm store cache mount so downloaded packages are reused across rebuilds.
# The shared cache id=pnpm is intentionally shared with other frontend builds in this monorepo.
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

# Stage 2: Builder
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY --from=deps /app ./
COPY apps/workout/frontend ./apps/workout/frontend

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_KEYCLOAK_URL
ENV NEXT_PUBLIC_KEYCLOAK_URL=$NEXT_PUBLIC_KEYCLOAK_URL
ARG NEXT_PUBLIC_FRONTEND_URL
ENV NEXT_PUBLIC_FRONTEND_URL=$NEXT_PUBLIC_FRONTEND_URL

WORKDIR /app/apps/workout/frontend
RUN pnpm run build

# Stage 3: Runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/workout/frontend/public ./apps/workout/frontend/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/workout/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/workout/frontend/.next/static ./apps/workout/frontend/.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "apps/workout/frontend/server.js"]
