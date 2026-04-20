# Chatrix

Classic web chat server (IRC/Slack-lite). Target: 300 concurrent users, 1000/room.

## Tech Stack

- **Backend:** Node 20, NestJS 10, Prisma 5, PostgreSQL 16, Redis 7
- **Frontend:** React 18, Vite, MUI v5, TanStack Query v5
- **Infra:** MinIO, Prosody (XMPP), Nginx, Docker Compose
- **Monorepo:** pnpm workspaces (shared / backend / frontend)

## Quick Start

### Full Stack (Docker Compose)

```bash
cp .env.example .env
docker compose up
```

Once running:

- Frontend: http://localhost/
- API health: http://localhost/api/health → `{"status":"ok","db":"ok"}`
- MinIO console: http://localhost:9001

### Development (HMR)

Start infra services only:

```bash
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis minio mc prosody
```

Run migrations and start apps with hot reload:

```bash
pnpm install
pnpm --filter backend prisma migrate dev
pnpm --filter backend dev   # http://localhost:3000/api/health
pnpm --filter frontend dev  # http://localhost:5173
```

## Common Commands

```bash
# Lint all packages
pnpm lint

# Typecheck all packages
pnpm -r typecheck

# Run all tests
pnpm -r test

# Build all packages
pnpm -r build

# Backend only
pnpm --filter backend test
pnpm --filter backend test:e2e
pnpm --filter backend test -- --testPathPattern=auth
pnpm --filter backend build
pnpm --filter backend prisma studio
pnpm --filter backend prisma generate

# Frontend only
pnpm --filter frontend test
pnpm --filter frontend build
```

## Environment Variables

Copy `.env.example` to `.env` and adjust for your environment. The backend validates all env vars at boot — missing or malformed vars cause a fast-fail with a clear error message.

Key variables:

| Variable                                | Description                  |
| --------------------------------------- | ---------------------------- |
| `DATABASE_URL`                          | PostgreSQL connection string |
| `REDIS_URL`                             | Redis connection string      |
| `JWT_ACCESS_SECRET`                     | Must be ≥32 chars            |
| `JWT_REFRESH_SECRET`                    | Must be ≥32 chars            |
| `MINIO_ENDPOINT` / `MINIO_PORT`         | Object storage host          |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | MinIO credentials            |
| `MINIO_BUCKET`                          | Upload bucket name           |
| `CORS_ORIGIN`                           | Allowed frontend origin      |
| `XMPP_DOMAIN`                           | XMPP federation domain       |
| `XMPP_COMPONENT_SECRET`                 | Prosody component secret     |

## Architecture

```
packages/
  shared/     # TS types, zod schemas, socket event names (single source of truth)
  backend/    # NestJS: auth, rooms, messages, health, prisma
  frontend/   # React SPA: features/, stores/, api/, socket/
prosody/      # XMPP federation stub config
nginx/        # Reverse proxy: serves FE + proxies /api and /socket.io
```

Controllers and gateways never call Prisma directly — always through services. Socket emits go through a dedicated `EventsService`. Frontend cross-feature sharing only via `components/`, `hooks/`, or `packages/shared`.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and pull request:

1. `pnpm install`
2. `pnpm lint`
3. `pnpm -r typecheck`
4. `pnpm -r test`
5. `pnpm -r build`
