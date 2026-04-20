# ── deps stage ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/
RUN pnpm install --frozen-lockfile --filter @chatrix/backend...

# ── build stage ───────────────────────────────────────────────────────────────
FROM deps AS build
COPY packages/shared/ ./packages/shared/
COPY packages/backend/ ./packages/backend/
RUN pnpm --filter @chatrix/backend build

# ── runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY --from=deps /app/package.json ./
COPY --from=deps /app/pnpm-workspace.yaml ./
COPY --from=deps /app/pnpm-lock.yaml ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/package.json ./packages/shared/
COPY --from=deps /app/packages/backend/package.json ./packages/backend/
COPY --from=deps /app/packages/backend/node_modules ./packages/backend/node_modules
COPY --from=build /app/packages/backend/dist ./packages/backend/dist
COPY --from=build /app/packages/backend/prisma ./packages/backend/prisma

WORKDIR /app/packages/backend

ENV NODE_ENV=production
EXPOSE 3000

ENTRYPOINT ["sh", "-c", "pnpm prisma migrate deploy && node dist/main.js"]
