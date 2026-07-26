# Stage 1: Dependencies
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable pnpm

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared ./packages/shared
COPY apps/shopping/frontend/package.json ./apps/shopping/frontend/

RUN pnpm install --no-frozen-lockfile --ignore-scripts

# Stage 2: Builder
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable pnpm

COPY --from=deps /app ./
COPY apps/shopping/frontend ./apps/shopping/frontend

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_PANTRY_API_URL
ENV NEXT_PUBLIC_PANTRY_API_URL=$NEXT_PUBLIC_PANTRY_API_URL

WORKDIR /app/apps/shopping/frontend
RUN pnpm run build

# Stage 3: Runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3010
ENV HOSTNAME="0.0.0.0"
ENV NODE_OPTIONS="--max-http-header-size=65536"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/shopping/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/shopping/frontend/.next/static ./apps/shopping/frontend/.next/static

USER nextjs

EXPOSE 3010

CMD ["node", "apps/shopping/frontend/server.js"]
