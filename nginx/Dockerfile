# Build context: repo root
FROM node:20-alpine AS frontend-builder
RUN corepack enable && corepack prepare pnpm@9 --activate
ENV HUSKY=0
WORKDIR /app

# Install full workspace so root devDeps (typescript, @types/*) and the shared
# workspace package are all available — matches the local dev environment.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/backend/package.json ./packages/backend/
COPY packages/backend/prisma ./packages/backend/prisma
RUN pnpm install --frozen-lockfile

COPY packages/shared/ ./packages/shared/
COPY packages/frontend/ ./packages/frontend/
RUN pnpm --filter @chatrix/shared build && pnpm --filter @chatrix/frontend build

FROM nginx:alpine
COPY --from=frontend-builder /app/packages/frontend/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
