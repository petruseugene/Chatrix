# ── deps stage ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9 --activate
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
RUN corepack enable && corepack prepare pnpm@9 --activate
RUN addgroup -S chatrix && adduser -S -G chatrix chatrix

WORKDIR /app

# Copy manifests for prod install
COPY --chown=chatrix:chatrix package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY --chown=chatrix:chatrix packages/shared/package.json ./packages/shared/
COPY --chown=chatrix:chatrix packages/backend/package.json ./packages/backend/

# Install only production deps
RUN pnpm install --frozen-lockfile --prod --filter @chatrix/backend...

# Copy compiled output and prisma
COPY --chown=chatrix:chatrix --from=build /app/packages/backend/dist ./packages/backend/dist
COPY --chown=chatrix:chatrix --from=build /app/packages/backend/prisma ./packages/backend/prisma

# Generate prisma client (needed even with --prod since @prisma/client is a dep)
RUN pnpm --filter @chatrix/backend exec prisma generate

WORKDIR /app/packages/backend
USER chatrix
ENV NODE_ENV=production
EXPOSE 3000
ENTRYPOINT ["sh", "-c", "pnpm prisma migrate deploy && node dist/main.js"]
