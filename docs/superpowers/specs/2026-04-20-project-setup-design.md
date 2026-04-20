# Project Setup — Design Spec

**Date:** 2026-04-20
**Status:** Approved, ready for implementation planning
**Scope:** Monorepo scaffolding + Docker infra. No product features.

## 1. Goal & Success Criteria

Establish a committed Chatrix monorepo where a fresh clone satisfies:

- `pnpm install && pnpm lint && pnpm -r typecheck && pnpm -r test && pnpm -r build` — all pass.
- `docker compose up` — boots Postgres, Redis, MinIO, Prosody, backend (with Prisma migrations auto-applied on boot), and Nginx-served frontend. `http://localhost/` loads the React app; `http://localhost/api/health` returns `{ status: 'ok', db: 'ok' }`.
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis minio prosody` + `pnpm --filter backend dev` + `pnpm --filter frontend dev` — HMR workflow works against containerized infra.

**Explicitly out of scope:** auth, users, rooms, messages, DMs, presence, attachments, moderation, XMPP bridge. Each gets its own spec.

## 2. Decisions (from brainstorming)

| # | Decision | Rationale |
|---|---|---|
| Q1 | Skeleton + hello-world apps + CI + Dockerfiles (option C) | Submission requires `docker compose up` end-to-end |
| Q2 | Lean monorepo tooling — no Turborepo, no changesets | 3 packages doesn't justify overhead |
| Q3 | Single prod compose file; `dev.yml` overlay brings up infra only | Matches CLAUDE.md dev workflow; apps run on host for HMR |
| Q4 | Nginx is the single entry: serves built FE + reverse-proxies `/api` and `/socket.io` | Single port, natural home for `client_max_body_size` |
| Q5 | CI runs lint/typecheck/test on PRs; `build` runs only on push to `main` | Fast PR feedback; build as pre/post-merge gate |
| Q6 | Prisma schema seeded with a single `User` model | Proves migrate-on-boot without front-loading domain |

## 3. Repo Layout

```
Chatrix/
├── .github/workflows/ci.yml
├── .husky/
├── .env.example
├── .gitignore
├── .editorconfig
├── .prettierrc.cjs
├── .eslintrc.cjs
├── tsconfig.base.json
├── package.json                     # root, private, workspace scripts
├── pnpm-workspace.yaml
├── docker-compose.yml               # prod-ish: infra + backend + nginx
├── docker-compose.dev.yml           # overlay: infra only
├── nginx/
│   ├── Dockerfile                   # nginx:alpine + built FE assets
│   └── default.conf
├── prosody/
│   └── prosody.cfg.lua              # s2s + component stub
├── packages/
│   ├── shared/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/index.ts             # empty barrel
│   ├── backend/
│   │   ├── Dockerfile               # multi-stage; entrypoint: migrate deploy && node dist/main.js
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── nest-cli.json
│   │   ├── prisma/schema.prisma     # User model only
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       ├── config/              # @nestjs/config + zod validation
│   │       ├── logger/              # Pino
│   │       ├── prisma/              # PrismaModule + PrismaService
│   │       └── health/              # GET /api/health
│   └── frontend/
│       ├── Dockerfile               # build stage only; output consumed by nginx image
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           └── theme.ts
└── prompt-history.md
```

## 4. Runtime Wiring

### Backend (`packages/backend`)

- `main.ts`: Nest app with Pino logger, Helmet, CORS from `CORS_ORIGIN`, global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`, global `/api` prefix, listens on `PORT`.
- `ConfigModule`: loads `.env`, validates with a zod schema at boot. Fails fast on missing/malformed env.
- `PrismaModule`: `PrismaService extends PrismaClient` with `onModuleInit` connect + `enableShutdownHooks`. Declared `@Global()`.
- `HealthController`: `GET /api/health` runs `SELECT 1` via Prisma, returns `{ status: 'ok', db: 'ok' }`.
- Container entrypoint: `sh -c "pnpm prisma migrate deploy && node dist/main.js"`. Relies on Prisma's advisory lock for safe concurrent startup at the current replica count.

### Frontend (`packages/frontend`)

- Vite + React 18 + TS strict. `main.tsx` mounts `<App />` inside `QueryClientProvider`, MUI `ThemeProvider`, `BrowserRouter`.
- `App.tsx`: single route `/` renders a placeholder page that calls `/api/health` via TanStack Query, proving the proxy.
- `vite.config.ts`: dev proxy `/api` → `http://localhost:3000`, `/socket.io` → same. Build outputs to `dist/`.

### Shared (`packages/shared`)

- Empty barrel today. Consumed by backend/frontend via `"@chatrix/shared": "workspace:*"`. Source shipped (no pre-build step); consumers' `tsc` handles compilation.

### Nginx (prod compose)

- Serves `/` from FE `dist/` with SPA fallback (`try_files $uri /index.html`).
- Proxies `/api/` → `backend:3000`, `/socket.io/` → `backend:3000` with `proxy_http_version 1.1`, `Upgrade`, `Connection` headers for WebSocket.
- `client_max_body_size 20m;` server-level, matching the 20MB file limit.

### Compose

- **`docker-compose.yml`** — services: `postgres:16`, `redis:7`, `minio/minio`, `minio/mc` (one-shot bucket bootstrap), `prosody/prosody`, `backend`, `nginx`. Healthchecks on Postgres, Redis, backend. Named volumes for Postgres, MinIO, Prosody.
- **`docker-compose.dev.yml`** — declares only `postgres`, `redis`, `minio`, `minio/mc`, `prosody`.

## 5. Tooling

### ESLint + Prettier

- Root `.eslintrc.cjs` with `@typescript-eslint`, `eslint-config-prettier`.
- Package overrides: backend adds `eslint-plugin-import` ordering; frontend adds `eslint-plugin-react`, `react-hooks`, `jsx-a11y`.
- Root Prettier config, no per-package overrides.

### Commit hooks

- `husky` + `lint-staged`: `pre-commit` runs `eslint --fix` + `prettier --write` on staged files.
- `commit-msg` runs `commitlint` with `@commitlint/config-conventional`.

### TypeScript

- `tsconfig.base.json`: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `target: ES2022`. Backend overrides `moduleResolution: node16`; frontend uses `bundler`.
- Packages extend base; each defines `outDir`, `rootDir`, `types`.

### Testing

- Backend: Jest via Nest CLI. Placeholder `health.controller.spec.ts`.
- Frontend: Vitest + `@testing-library/react` + jsdom. Placeholder test on `App.tsx`.

### CI (`.github/workflows/ci.yml`)

Single workflow, single job, Node 20, pnpm via `pnpm/action-setup`, dependency cache keyed on `pnpm-lock.yaml`. Triggers: `push`, `pull_request`.

Steps:
1. `checkout`
2. `setup-node`
3. `setup-pnpm`
4. `pnpm install --frozen-lockfile`
5. `pnpm lint`
6. `pnpm -r typecheck`
7. `pnpm -r test`
8. `pnpm -r build` — **gated:** `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`

## 6. Env & Secrets

`.env.example` committed; real `.env` gitignored. Validated by zod at backend boot.

```
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:5173

DATABASE_URL=postgresql://chatrix:chatrix@postgres:5432/chatrix
REDIS_URL=redis://redis:6379

JWT_ACCESS_SECRET=change-me-dev-only
JWT_REFRESH_SECRET=change-me-dev-only
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d

MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=chatrix
MINIO_SECRET_KEY=chatrix-dev-only
MINIO_BUCKET=chatrix-uploads
MINIO_USE_SSL=false

XMPP_DOMAIN=chatrix.local
XMPP_COMPONENT_SECRET=change-me-dev-only
```

## 7. Known Risks & Trade-offs

1. **Prosody config is a stub.** s2s declared, component port open, but the XMPP bridge is deferred to a later feature. Setup just needs it to start cleanly.
2. **MinIO bucket bootstrap.** A one-shot `minio/mc` service runs `mc mb --ignore-existing chatrix-uploads` after MinIO is healthy. Idempotent; decoupled from app code.
3. **Migration on entrypoint.** At current scale, Prisma's advisory lock handles concurrent backend starts. Revisit with a dedicated init job if replicas >2.
4. **Nginx WebSocket headers.** Easy to miss; included from day one for `/socket.io/`.
5. **`shared` consumption via source.** No build step today. If consumer build times hurt later, switch to pre-built `dist/`.

## 8. Feature-Done Checklist (for this spec)

- [ ] Root workspace files (`package.json`, `pnpm-workspace.yaml`, tsconfig base, ESLint, Prettier, commit hooks) in place; `pnpm install` succeeds.
- [ ] `packages/shared` builds and is linked by consumers.
- [ ] `packages/backend`: Nest app boots, `ConfigModule` validates env, Prisma client generates, `User` migration exists, `/api/health` returns DB-checked ok, Jest spec green.
- [ ] `packages/frontend`: Vite app builds, renders placeholder page, calls `/api/health` via TanStack Query in dev, Vitest spec green.
- [ ] `Dockerfile`s for backend + frontend + nginx produce runnable images.
- [ ] `docker-compose.yml` boots full stack; `curl localhost/api/health` works; FE served at `/`.
- [ ] `docker-compose.dev.yml` brings up infra only; `pnpm dev` on host works against it.
- [ ] CI workflow runs green on a PR; build step runs only on push to `main`.
- [ ] `.env.example` committed; real `.env` gitignored.
