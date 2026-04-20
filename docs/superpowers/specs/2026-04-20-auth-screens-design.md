# Auth Screens Design — Frontend Login / Register / Reset Password

**Date:** 2026-04-20
**Feature:** Frontend auth screens
**Status:** Approved

---

## 1. Scope

Implements the frontend auth flow: login, register, forgot-password, and reset-password screens. Covers routing, auth state management, API integration, form validation, and UI. Change-password (authenticated account settings) is out of scope.

---

## 2. Visual Design

- **Layout:** Full-bleed gradient background filling the viewport; frosted-glass white card centered on top.
- **Gradient:** Sky → Indigo (`#0ea5e9` → `#6366f1`), 135° angle.
- **Theme:** MUI light mode. Primary color `#6366f1`, secondary `#0ea5e9`.
- **Mobile-first:** Card is full-width on small screens, max-width constrained on desktop. All screens use the same shell.

---

## 3. Screens & Routes

| Route                     | Screen               | Description                                                 |
| ------------------------- | -------------------- | ----------------------------------------------------------- |
| `/auth`                   | `AuthPage`           | Glass card with Login / Register tabs                       |
| `/forgot-password`        | `ForgotPasswordPage` | Single email field; success state after submit              |
| `/reset-password?token=…` | `ResetPasswordPage`  | New password + confirm; error state if token absent/invalid |
| `/` (and all others)      | `RequireAuth`        | Redirects unauthenticated users to `/auth`                  |

### AuthPage tabs

- **Login tab:** email, password fields. "Forgot password?" link below submit button.
- **Register tab:** username, email, password fields. No footer link.
- Tabs switch instantly; URL stays `/auth` with a `?tab=login|register` query param for deep-linking. Default tab is `login`.

### ForgotPasswordPage

- Title + brief subtitle, single email field, submit button, "Back to login" link.
- After successful submit: replace form with a success message (no re-request on the same render).

### ResetPasswordPage

- Reads `token` from the URL query string on mount.
- If token is absent: show an error state with a "Back to login" link immediately — no form rendered.
- Fields: new password, confirm password. Confirm-password is UI-only — it is validated client-side as a matching field and is not part of `resetPasswordSchema` from shared.
- On success: redirect to `/auth?tab=login`.

---

## 4. Architecture

### Auth store (`stores/authStore.ts`)

Zustand store holding:

- `user: JwtPayload | null`
- `accessToken: string | null`
- `setAuth(user, accessToken)` — called after login, register, and silent refresh
- `clearAuth()` — called after logout

Access token lives in memory only (never localStorage). This eliminates XSS token theft.

### Silent refresh on boot

`components/AppBootstrap.tsx` wraps the router outlet and calls `POST /auth/refresh` once on mount. On success it calls `setAuth`; on failure (401) it does nothing. This rehydrates the session from the httpOnly refresh-token cookie after a page reload. `AppBootstrap` renders a blank screen while the refresh is in-flight to avoid a flash of the login page.

### API layer (`features/auth/authApi.ts`)

Plain async fetch functions for each backend endpoint:

- `login(email, password)` → `{ accessToken, user }`
- `register(email, username, password)` → `{ accessToken, user }`
- `logout()` → void
- `requestReset(email)` → void
- `resetPassword(token, newPassword)` → void

### Mutations (`features/auth/useAuthMutations.ts`)

TanStack Query `useMutation` hooks wrapping `authApi`. Each hook:

- Calls `setAuth` / `clearAuth` on the Zustand store on success
- Returns `isPending` and `error` for inline form feedback

### Form validation

All forms use `react-hook-form` with `@hookform/resolvers/zod`. Schemas are imported from `@chatrix/shared` (`loginSchema`, `registerSchema`, `requestResetSchema`, `resetPasswordSchema`). No schema duplication between FE and BE.

---

## 5. File Structure

```
packages/frontend/src/
  features/
    auth/
      AuthPage.tsx
      LoginForm.tsx
      RegisterForm.tsx
      ForgotPasswordPage.tsx
      ResetPasswordPage.tsx
      authApi.ts
      useAuthMutations.ts
  stores/
    authStore.ts
  components/
    RequireAuth.tsx
    AppBootstrap.tsx
  App.tsx            (updated with routes)
  theme.ts           (updated: light mode, indigo primary)
```

---

## 6. Dependencies to Add

- `zustand`
- `react-hook-form`
- `@hookform/resolvers`

`zod` is already available via `@chatrix/shared` workspace dependency.

---

## 7. Testing Strategy

- Unit test `authStore` actions (setAuth, clearAuth).
- Unit test `useAuthMutations` hooks using `msw` or mocked fetch — verify store is updated on success and error is surfaced on failure.
- Component tests for `LoginForm`, `RegisterForm`, `ForgotPasswordPage`, `ResetPasswordPage` using `@testing-library/react` — cover validation errors, submit states, and success states.
- `RequireAuth` test: unauthenticated renders redirect; authenticated renders children.

Target: 70%+ coverage on auth feature files.

---

## 8. Decisions Made

| Question                  | Decision                                              |
| ------------------------- | ----------------------------------------------------- |
| Layout                    | Full-bleed gradient + glass card                      |
| Color                     | Sky → Indigo (`#0ea5e9` → `#6366f1`)                  |
| Login/Register navigation | Tabs at top of card, single `/auth` route             |
| Auth state                | Zustand store, access token in memory only            |
| Form validation           | react-hook-form + zod, schemas from `@chatrix/shared` |
| Change-password screen    | Out of scope (account settings, not auth)             |
| Token persistence         | None — silent refresh on boot from httpOnly cookie    |
