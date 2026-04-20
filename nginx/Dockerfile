# Build context: repo root
FROM node:20-alpine AS frontend-builder
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/frontend/package.json ./packages/frontend/
RUN pnpm install --frozen-lockfile --filter @chatrix/frontend...

COPY packages/shared/ ./packages/shared/
COPY packages/frontend/ ./packages/frontend/
RUN pnpm --filter @chatrix/frontend build

FROM nginx:alpine
COPY --from=frontend-builder /app/packages/frontend/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
