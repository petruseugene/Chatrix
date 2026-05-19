# ── deps stage ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
# Prisma needs openssl + libc compat at install/codegen time on Alpine.
RUN apk add --no-cache openssl libc6-compat
RUN corepack enable && corepack prepare pnpm@9 --activate
ENV HUSKY=0
WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/
# Prisma schema must be present before install (backend postinstall runs prisma generate)
COPY packages/backend/prisma ./packages/backend/prisma
RUN pnpm install --frozen-lockfile --filter @chatrix/backend...

# ── build stage ───────────────────────────────────────────────────────────────
FROM deps AS build
COPY packages/shared/ ./packages/shared/
COPY packages/backend/ ./packages/backend/
RUN pnpm --filter @chatrix/shared build && pnpm --filter @chatrix/backend build

# ── runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
# Prisma + argon2/sharp native modules need openssl + libc compat on Alpine.
RUN apk add --no-cache openssl libc6-compat
RUN corepack enable && corepack prepare pnpm@9 --activate
RUN addgroup -S chatrix && adduser -S -G chatrix chatrix
ENV HUSKY=0

WORKDIR /app

# Copy manifests for prod install
COPY --chown=chatrix:chatrix package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY --chown=chatrix:chatrix packages/shared/package.json ./packages/shared/
COPY --chown=chatrix:chatrix packages/backend/package.json ./packages/backend/

# Prisma schema must be present before install so the backend's
# postinstall (`prisma generate`) can find it.
COPY --chown=chatrix:chatrix packages/backend/prisma ./packages/backend/prisma

# Install only production deps, then hand ownership to the chatrix user
# so Prisma can write its engine cache at runtime.
RUN pnpm install --frozen-lockfile --prod --filter @chatrix/backend... \
 && chown -R chatrix:chatrix /app

# Copy compiled output (backend dist + shared dist for the workspace symlink)
COPY --chown=chatrix:chatrix --from=build /app/packages/backend/dist ./packages/backend/dist
COPY --chown=chatrix:chatrix --from=build /app/packages/shared/dist ./packages/shared/dist

WORKDIR /app/packages/backend
USER chatrix
ENV NODE_ENV=production
EXPOSE 3000
ENTRYPOINT ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/main.js"]
