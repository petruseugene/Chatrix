FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/frontend/package.json ./packages/frontend/
RUN pnpm install --frozen-lockfile --filter @chatrix/frontend...

COPY packages/shared/ ./packages/shared/
COPY packages/frontend/ ./packages/frontend/
RUN pnpm --filter @chatrix/frontend build
