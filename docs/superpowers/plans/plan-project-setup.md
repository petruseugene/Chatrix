# Project Setup — Implementation Plan

> **Status:** IN_PROGRESS
> **Spec:** `docs/superpowers/specs/2026-04-20-project-setup-design.md`
> **For agentic workers:** Use project-manager skill to execute task-by-task.

**Goal:** Scaffold the Chatrix monorepo so a fresh clone passes `pnpm install && pnpm lint && pnpm -r typecheck && pnpm -r test && pnpm -r build` and `docker compose up` boots the full infra + backend + Nginx-served frontend end-to-end, with `/api/health` returning DB-checked OK.

**Architecture:** pnpm workspaces monorepo with three packages (`shared`, `backend`, `frontend`). Backend is NestJS 10 + Prisma 5 with migrate-on-boot entrypoint. Frontend is Vite + React 18 built into static assets served by Nginx, which also reverse-proxies `/api` and `/socket.io` to the backend. Prod compose brings up Postgres, Redis, MinIO (+ mc bootstrap), Prosody (stub), backend, Nginx. Dev overlay runs infra only.

**Tech Stack:** Node 20, pnpm, TS strict. Backend: NestJS 10, Prisma 5, Pino, Helmet, zod-validated `ConfigModule`. Frontend: Vite, React 18, MUI v5, TanStack Query v5, React Router v6. Infra: Postgres 16, Redis 7, MinIO, Prosody, Nginx. Tooling: ESLint, Prettier, Husky, lint-staged, commitlint, Jest (BE), Vitest (FE), GitHub Actions CI.

---

## File Map

| Action | Path                                                                       | Purpose                                                      |
| ------ | -------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Create | `package.json`, `pnpm-workspace.yaml`                                      | Root workspace config + scripts                              |
| Create | `tsconfig.base.json`                                                       | Shared TS strict config                                      |
| Create | `.eslintrc.cjs`, `.prettierrc.cjs`, `.editorconfig`                        | Lint/format baseline                                         |
| Create | `.gitignore`, `.env.example`                                               | Repo hygiene + env contract                                  |
| Create | `.husky/pre-commit`, `.husky/commit-msg`, `commitlint.config.cjs`          | Commit hooks                                                 |
| Create | `.github/workflows/ci.yml`                                                 | CI: lint/typecheck/test on PR, build on push to main         |
| Create | `packages/shared/{package.json,tsconfig.json,src/index.ts}`                | Empty shared barrel                                          |
| Create | `packages/backend/package.json`, `tsconfig.json`, `nest-cli.json`          | Nest package                                                 |
| Create | `packages/backend/prisma/schema.prisma`                                    | `User` model only                                            |
| Create | `packages/backend/src/{main.ts,app.module.ts}`                             | Nest bootstrap                                               |
| Create | `packages/backend/src/config/`                                             | zod-validated ConfigModule                                   |
| Create | `packages/backend/src/logger/`                                             | Pino logger module                                           |
| Create | `packages/backend/src/prisma/`                                             | PrismaModule + PrismaService (@Global)                       |
| Create | `packages/backend/src/health/`                                             | `GET /api/health` (+ spec)                                   |
| Create | `packages/backend/Dockerfile`                                              | Multi-stage; entrypoint: migrate deploy && node dist/main.js |
| Create | `packages/frontend/{package.json,tsconfig.json,vite.config.ts,index.html}` | Vite package                                                 |
| Create | `packages/frontend/src/{main.tsx,App.tsx,theme.ts}`                        | React bootstrap + health probe                               |
| Create | `packages/frontend/Dockerfile`                                             | Build stage producing `dist/`                                |
| Create | `nginx/Dockerfile`, `nginx/default.conf`                                   | Serves FE + proxies /api, /socket.io                         |
| Create | `prosody/prosody.cfg.lua`                                                  | s2s + component stub                                         |
| Create | `docker-compose.yml`                                                       | Full stack (infra + backend + nginx)                         |
| Create | `docker-compose.dev.yml`                                                   | Infra-only overlay                                           |
| Create | `README.md` (update)                                                       | How to run dev + compose                                     |

---

## Task 1: Root workspace scaffolding

**Status:** TODO
**Relevant files:** `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.eslintrc.cjs`, `.prettierrc.cjs`, `.editorconfig`, `.gitignore`, `.env.example`
**Skill to use:** none (straightforward scaffolding)
**Acceptance criteria:**

- [ ] `pnpm-workspace.yaml` declares `packages/*`
- [ ] Root `package.json` is private, defines `lint`, `typecheck`, `test`, `build`, `dev` scripts (delegating to `pnpm -r`)
- [ ] `tsconfig.base.json` sets `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `target: ES2022`
- [ ] Root ESLint config with `@typescript-eslint` + `eslint-config-prettier`; Prettier config at root
- [ ] `.env.example` committed with every var listed in spec §6; real `.env` gitignored
- [ ] `pnpm install` succeeds on a clean clone

---

## Task 2: Commit hooks + conventional commits

**Status:** TODO
**Relevant files:** `.husky/pre-commit`, `.husky/commit-msg`, `commitlint.config.cjs`, root `package.json`
**Skill to use:** none
**Acceptance criteria:**

- [ ] `husky` + `lint-staged` configured; pre-commit runs `eslint --fix` + `prettier --write` on staged files
- [ ] `commit-msg` hook runs commitlint with `@commitlint/config-conventional`
- [ ] `pnpm install` wires up husky via `prepare` script

---

## Task 3: `packages/shared` empty barrel

**Status:** TODO
**Relevant files:** `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/index.ts`
**Skill to use:** none
**Acceptance criteria:**

- [ ] Package name `@chatrix/shared`, exports source (no build step), extends base tsconfig
- [ ] Consumed by backend/frontend via `"@chatrix/shared": "workspace:*"`
- [ ] `pnpm -r typecheck` passes with the empty barrel imported nowhere yet

---

## Task 4: Backend Nest app skeleton + ConfigModule + Logger

**Status:** TODO
**Relevant files:** `packages/backend/package.json`, `tsconfig.json`, `nest-cli.json`, `src/main.ts`, `src/app.module.ts`, `src/config/*`, `src/logger/*`
**Skill to use:** superpowers:test-driven-development
**Acceptance criteria:**

- [ ] Nest boots with Pino logger, Helmet, CORS from `CORS_ORIGIN`, global `/api` prefix, global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`
- [ ] `ConfigModule` validates env with a zod schema at boot and fails fast on missing/malformed vars
- [ ] Listens on `PORT` from env
- [ ] `pnpm --filter backend build` succeeds; `pnpm --filter backend test` green

---

## Task 5: Prisma + User model + PrismaModule

**Status:** TODO
**Relevant files:** `packages/backend/prisma/schema.prisma`, `packages/backend/src/prisma/prisma.module.ts`, `prisma.service.ts`
**Skill to use:** none
**Acceptance criteria:**

- [ ] `schema.prisma` defines only `User` (id, email UNIQUE, username UNIQUE, passwordHash, createdAt, deletedAt nullable)
- [ ] `PrismaService extends PrismaClient` with `onModuleInit` connect + `enableShutdownHooks`
- [ ] `PrismaModule` is `@Global()` and exports `PrismaService`
- [ ] `pnpm --filter backend prisma migrate dev --name init` produces an initial migration

---

## Task 6: Health endpoint

**Status:** TODO
**Relevant files:** `packages/backend/src/health/health.controller.ts`, `health.module.ts`, `health.controller.spec.ts`
**Skill to use:** superpowers:test-driven-development
**Acceptance criteria:**

- [ ] `GET /api/health` runs `SELECT 1` via Prisma and returns `{ status: 'ok', db: 'ok' }`
- [ ] Returns non-200 (or `db: 'error'`) when DB unreachable
- [ ] Unit spec covers both paths with a mocked Prisma service

---

## Task 7: Frontend Vite + React skeleton

**Status:** TODO
**Relevant files:** `packages/frontend/package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/theme.ts`
**Skill to use:** none
**Acceptance criteria:**

- [ ] `main.tsx` mounts `<App />` inside `QueryClientProvider`, MUI `ThemeProvider`, `BrowserRouter`
- [ ] `App.tsx` renders a placeholder page that calls `/api/health` via a TanStack Query hook and shows the status
- [ ] `vite.config.ts` dev proxy: `/api` and `/socket.io` → `http://localhost:3000`
- [ ] Vitest + RTL placeholder test on `App.tsx` green
- [ ] `pnpm --filter frontend build` produces `dist/`

---

## Task 8: Dockerfiles (backend, frontend, nginx)

**Status:** TODO
**Relevant files:** `packages/backend/Dockerfile`, `packages/frontend/Dockerfile`, `nginx/Dockerfile`, `nginx/default.conf`
**Skill to use:** none
**Acceptance criteria:**

- [ ] Backend Dockerfile is multi-stage (deps → build → runtime), entrypoint `sh -c "pnpm prisma migrate deploy && node dist/main.js"`, pnpm available in runtime stage
- [ ] Frontend Dockerfile is build-only, producing `/app/packages/frontend/dist`
- [ ] Nginx Dockerfile pulls FE `dist` via a builder stage; `default.conf` serves `/` with SPA fallback, proxies `/api/` and `/socket.io/` to `backend:3000` with WS `Upgrade`/`Connection` headers, sets `client_max_body_size 20m;`
- [ ] All three images build cleanly

---

## Task 9: Prosody stub config

**Status:** TODO
**Relevant files:** `prosody/prosody.cfg.lua`
**Skill to use:** none
**Acceptance criteria:**

- [ ] Config declares s2s enabled and a component listener on the conventional port for the stub
- [ ] Prosody container starts cleanly with this config in compose (no bridge logic yet)

---

## Task 10: docker-compose (prod + dev overlay)

**Status:** TODO
**Relevant files:** `docker-compose.yml`, `docker-compose.dev.yml`
**Skill to use:** none
**Acceptance criteria:**

- [ ] `docker-compose.yml` defines services: `postgres:16`, `redis:7`, `minio`, `minio/mc` one-shot bucket bootstrap, `prosody`, `backend`, `nginx`; healthchecks on Postgres, Redis, backend; named volumes for Postgres/MinIO/Prosody
- [ ] `minio/mc` service runs `mc mb --ignore-existing` for `MINIO_BUCKET` after MinIO is healthy and exits 0
- [ ] `docker-compose.dev.yml` overlays to declare `postgres`, `redis`, `minio`, `minio/mc`, `prosody` only
- [ ] Bare `docker compose up` boots everything end-to-end; `curl http://localhost/api/health` returns `{status:'ok',db:'ok'}`; `http://localhost/` loads the React placeholder page
- [ ] `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis minio prosody` + `pnpm --filter backend dev` + `pnpm --filter frontend dev` gives a working HMR loop

---

## Task 11: CI workflow

**Status:** TODO
**Relevant files:** `.github/workflows/ci.yml`
**Skill to use:** none
**Acceptance criteria:**

- [ ] Single workflow, single job, Node 20, pnpm via `pnpm/action-setup`, dependency cache keyed on `pnpm-lock.yaml`
- [ ] Triggers on `push` and `pull_request`
- [ ] Steps: checkout → setup-node → setup-pnpm → `pnpm install --frozen-lockfile` → `pnpm lint` → `pnpm -r typecheck` → `pnpm -r test` → `pnpm -r build` (gated on `push` to `main`)
- [ ] Workflow passes green on a PR against this plan

---

## Task 12: README + verification pass

**Status:** TODO
**Relevant files:** `README.md`
**Skill to use:** superpowers:verification-before-completion
**Acceptance criteria:**

- [ ] README documents both workflows: full `docker compose up` and dev (`docker compose ... up infra` + `pnpm dev`)
- [ ] All checklist items in spec §8 verified by running the commands locally; output captured in the PR description
- [ ] `pnpm install && pnpm lint && pnpm -r typecheck && pnpm -r test && pnpm -r build` all pass on a fresh clone
