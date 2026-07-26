# Stage 1: Dependencies
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable pnpm

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared ./packages/shared
COPY apps/maintenance/frontend/package.json ./apps/maintenance/frontend/

RUN pnpm install --no-frozen-lockfile --ignore-scripts

# Stage 2: Builder
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable pnpm

COPY --from=deps /app ./
COPY apps/maintenance/frontend ./apps/maintenance/frontend

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

WORKDIR /app/apps/maintenance/frontend
RUN pnpm run build

# Stage 3: Runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

RUN mkdir -p ./apps/maintenance/frontend/public

COPY --from=builder /app/apps/maintenance/frontend/public ./apps/maintenance/frontend/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/maintenance/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/maintenance/frontend/.next/static ./apps/maintenance/frontend/.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "apps/maintenance/frontend/server.js"]
