# Auth Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build login, register, forgot-password, and reset-password screens with full auth state management.

**Architecture:** Full-bleed sky→indigo gradient with a frosted-glass card. Zustand holds auth state in memory; TanStack Query mutations call the backend; react-hook-form + zod (from shared) handle validation.

**Tech Stack:** React 18, MUI v5, Zustand, TanStack Query v5, react-hook-form, @hookform/resolvers, zod (via @chatrix/shared), react-router v6

**Spec:** `docs/superpowers/specs/2026-04-20-auth-screens-design.md`

---

## File Map

| Action | Path                                                              |
| ------ | ----------------------------------------------------------------- |
| Modify | `packages/frontend/package.json`                                  |
| Modify | `packages/frontend/src/theme.ts`                                  |
| Create | `packages/frontend/src/stores/authStore.ts`                       |
| Create | `packages/frontend/src/stores/authStore.test.ts`                  |
| Create | `packages/frontend/src/features/auth/authApi.ts`                  |
| Create | `packages/frontend/src/features/auth/useAuthMutations.ts`         |
| Create | `packages/frontend/src/features/auth/useAuthMutations.test.ts`    |
| Create | `packages/frontend/src/components/AppBootstrap.tsx`               |
| Create | `packages/frontend/src/components/RequireAuth.tsx`                |
| Create | `packages/frontend/src/components/RequireAuth.test.tsx`           |
| Modify | `packages/frontend/src/App.tsx`                                   |
| Create | `packages/frontend/src/features/auth/AuthPage.tsx`                |
| Create | `packages/frontend/src/features/auth/LoginForm.tsx`               |
| Create | `packages/frontend/src/features/auth/LoginForm.test.tsx`          |
| Create | `packages/frontend/src/features/auth/RegisterForm.tsx`            |
| Create | `packages/frontend/src/features/auth/RegisterForm.test.tsx`       |
| Create | `packages/frontend/src/features/auth/ForgotPasswordPage.tsx`      |
| Create | `packages/frontend/src/features/auth/ForgotPasswordPage.test.tsx` |
| Create | `packages/frontend/src/features/auth/ResetPasswordPage.tsx`       |
| Create | `packages/frontend/src/features/auth/ResetPasswordPage.test.tsx`  |

---

## Task 1: Install dependencies and update theme

**Files:**

- Modify: `packages/frontend/package.json`
- Modify: `packages/frontend/src/theme.ts`

- [ ] Add `zustand`, `react-hook-form`, and `@hookform/resolvers` to dependencies in `packages/frontend/package.json`
- [ ] Run `pnpm install` from the repo root
- [ ] Update `theme.ts`: switch `mode` to `light`, set `primary.main` to `#6366f1`, add `secondary.main` as `#0ea5e9`
- [ ] Start the dev server and confirm the health-check page renders in light mode: `pnpm --filter frontend dev`
- [ ] Commit

---

## Task 2: Auth store

**Files:**

- Create: `packages/frontend/src/stores/authStore.ts`
- Create: `packages/frontend/src/stores/authStore.test.ts`

- [ ] Create `authStore.ts` — Zustand store with `user: JwtPayload | null`, `accessToken: string | null`, `setAuth(user, accessToken)`, and `clearAuth()`. Import `JwtPayload` from `@chatrix/shared`
- [ ] Write tests in `authStore.test.ts`: verify initial state is null, `setAuth` sets both fields, `clearAuth` resets both to null
- [ ] Run tests: `pnpm --filter frontend test`
- [ ] Commit

---

## Task 3: Auth API layer

**Files:**

- Create: `packages/frontend/src/features/auth/authApi.ts`

- [ ] Create `authApi.ts` with five async fetch functions: `login`, `register`, `logout`, `requestReset`, `resetPassword`
- [ ] Each function calls the corresponding backend endpoint under `/api/auth/` and throws on non-ok responses
- [ ] `login` and `register` return `{ accessToken: string, user: JwtPayload }`; the others return `void`
- [ ] No tests needed for this file — it is a thin fetch wrapper; mutations cover the integration
- [ ] Commit

---

## Task 4: Auth mutation hooks

**Files:**

- Create: `packages/frontend/src/features/auth/useAuthMutations.ts`
- Create: `packages/frontend/src/features/auth/useAuthMutations.test.ts`

- [ ] Create `useAuthMutations.ts` exporting one `useMutation` hook per auth action (`useLogin`, `useRegister`, `useLogout`, `useRequestReset`, `useResetPassword`)
- [ ] `useLogin` and `useRegister` call `setAuth` on success; `useLogout` calls `clearAuth` on success
- [ ] Each hook returns `isPending` and `error` for the caller to use in the UI
- [ ] Write tests in `useAuthMutations.test.ts`: mock `authApi` functions, verify store is updated on success and error is forwarded on failure for `useLogin` and `useRegister`
- [ ] Run tests: `pnpm --filter frontend test`
- [ ] Commit

---

## Task 5: AppBootstrap and RequireAuth

**Files:**

- Create: `packages/frontend/src/components/AppBootstrap.tsx`
- Create: `packages/frontend/src/components/RequireAuth.tsx`
- Create: `packages/frontend/src/components/RequireAuth.test.tsx`

- [ ] Create `AppBootstrap.tsx` — on mount, call `POST /api/auth/refresh`; on success call `setAuth`; on failure (401) do nothing. Render `null` (blank) while the request is in-flight; render children after it settles
- [ ] Create `RequireAuth.tsx` — read `accessToken` from the store; if null redirect to `/auth`; otherwise render children via `<Outlet />`
- [ ] Write tests in `RequireAuth.test.tsx`: when store has no token it redirects to `/auth`; when store has a token it renders the child route
- [ ] Run tests: `pnpm --filter frontend test`
- [ ] Commit

---

## Task 6: Routing

**Files:**

- Modify: `packages/frontend/src/App.tsx`

- [ ] Replace the current health-check component in `App.tsx` with react-router v6 routes
- [ ] Wrap `AppBootstrap` around all routes
- [ ] Add public routes: `/auth` → `AuthPage`, `/forgot-password` → `ForgotPasswordPage`, `/reset-password` → `ResetPasswordPage`
- [ ] Add a protected route using `RequireAuth` for `/` (placeholder `<div>Chat coming soon</div>` for now)
- [ ] Add a catch-all that redirects unknown paths to `/auth`
- [ ] Start the dev server and manually verify navigating to `/auth` loads without errors
- [ ] Commit

---

## Task 7: AuthPage shell and LoginForm

**Files:**

- Create: `packages/frontend/src/features/auth/AuthPage.tsx`
- Create: `packages/frontend/src/features/auth/LoginForm.tsx`
- Create: `packages/frontend/src/features/auth/LoginForm.test.tsx`

- [ ] Create `AuthPage.tsx` — full-viewport `Box` with a 135° sky→indigo gradient background; centered MUI `Paper` (glass card: semi-transparent white, backdrop blur, border-radius, box-shadow); max-width 400px on desktop, full-width on mobile
- [ ] Add a logo row (MUI icon or text) at the top of the card, then MUI `Tabs` with "Login" and "Register" tabs; read the active tab from the `?tab=` query param (default `login`); update the query param on tab change
- [ ] Render `<LoginForm />` or `<RegisterForm />` based on active tab
- [ ] Create `LoginForm.tsx` — react-hook-form with `loginSchema` from `@chatrix/shared`; email and password `TextField`s; submit `Button` showing spinner when `isPending`; "Forgot password?" `Link` navigating to `/forgot-password`; inline `Alert` on error
- [ ] Write tests in `LoginForm.test.tsx`: required field validation shows errors on empty submit; submit calls mutation with correct values; error alert renders on mutation failure
- [ ] Run tests: `pnpm --filter frontend test`
- [ ] Open dev server and manually verify login form renders, tabs switch, and validation triggers
- [ ] Commit

---

## Task 8: RegisterForm

**Files:**

- Create: `packages/frontend/src/features/auth/RegisterForm.tsx`
- Create: `packages/frontend/src/features/auth/RegisterForm.test.tsx`

- [ ] Create `RegisterForm.tsx` — react-hook-form with `registerSchema` from `@chatrix/shared`; username, email, password `TextField`s; submit `Button` with spinner; inline `Alert` on error
- [ ] Write tests in `RegisterForm.test.tsx`: validation errors on empty submit; username regex error on invalid input; successful submit calls mutation; error alert on failure
- [ ] Run tests: `pnpm --filter frontend test`
- [ ] Open dev server, switch to Register tab, verify the three fields render and validation works
- [ ] Commit

---

## Task 9: ForgotPasswordPage

**Files:**

- Create: `packages/frontend/src/features/auth/ForgotPasswordPage.tsx`
- Create: `packages/frontend/src/features/auth/ForgotPasswordPage.test.tsx`

- [ ] Create `ForgotPasswordPage.tsx` — same glass-card shell as `AuthPage`; title and subtitle text; react-hook-form with `requestResetSchema`; single email field; submit button; "Back to login" link to `/auth`
- [ ] After successful mutation, replace the form with a success message (do not re-render the form on the same mount)
- [ ] Write tests: email validation shows error on empty submit; on success the form is replaced by the success message; "Back to login" link is present
- [ ] Run tests: `pnpm --filter frontend test`
- [ ] Open dev server at `/forgot-password` and verify the form and success state
- [ ] Commit

---

## Task 10: ResetPasswordPage

**Files:**

- Create: `packages/frontend/src/features/auth/ResetPasswordPage.tsx`
- Create: `packages/frontend/src/features/auth/ResetPasswordPage.test.tsx`

- [ ] Create `ResetPasswordPage.tsx` — same glass-card shell; read `token` from `useSearchParams` on mount
- [ ] If token is absent, render an error state with a "Back to login" link — do not render the form
- [ ] If token is present, render a react-hook-form with `resetPasswordSchema` extended with a client-side `confirmPassword` field (`.refine` that both passwords match); new password and confirm password `TextField`s; submit button
- [ ] On success, navigate to `/auth?tab=login`
- [ ] Write tests: missing token renders error state; password mismatch shows validation error; successful submit navigates to login; API error renders inline alert
- [ ] Run tests: `pnpm --filter frontend test`
- [ ] Open dev server at `/reset-password` (no token) and `/reset-password?token=abc` and verify both states
- [ ] Commit

---

## Task 11: Final smoke test

- [ ] Run the full test suite: `pnpm --filter frontend test`
- [ ] Start the dev server with the backend running; complete the full happy path: register → auto-login → reload page (silent refresh) → logout → login → forgot-password form → back to login
- [ ] Check mobile layout in browser devtools (375px width) — card should be full-width with adequate padding
- [ ] Commit any remaining fixes
