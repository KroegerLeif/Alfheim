# syntax=docker/dockerfile:1

# Stage 1: Dependencies
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable pnpm

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared ./packages/shared
COPY apps/chores/frontend/package.json ./apps/chores/frontend/

# Use BuildKit pnpm store cache mount so downloaded packages are reused across rebuilds.
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

# Stage 2: Builder
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable pnpm

COPY --from=deps /app ./
COPY apps/chores/frontend ./apps/chores/frontend

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

WORKDIR /app/apps/chores/frontend
RUN pnpm run build

# Stage 3: Runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/chores/frontend/public ./apps/chores/frontend/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/chores/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/chores/frontend/.next/static ./apps/chores/frontend/.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "apps/chores/frontend/server.js"]
