FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@9 --activate
ENV HUSKY=0
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/frontend/package.json ./packages/frontend/
RUN pnpm install --frozen-lockfile --filter @chatrix/frontend...

COPY packages/shared/ ./packages/shared/
COPY packages/frontend/ ./packages/frontend/
RUN pnpm --filter @chatrix/frontend build
