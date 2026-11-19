# Architecture

## Overview

```text
Browser (React SPA)  ──/api/v1 (same origin via reverse proxy / Vite proxy)──▶  Express API  ──▶  MongoDB replica set
   TanStack Query cache                                                             │
   access token in memory                                                           ├─ SMTP (email)
   refresh token = HttpOnly cookie                                                  └─ (planned) S3 storage, payment providers, job queue
```

Both apps import `@alifya/shared`, so validation rules, permission keys, enum values and response types are defined once.

## Backend (`backend`)

- `src/config` — zod-validated environment (`env.ts`; production refuses console email or insecure cookies), pino logger with secret redaction.
- `src/middleware` — `authenticate` (JWT + live session/status/role lookup per request), `requirePermission`, CSRF double-submit, rate limiters, central error handler.
- `src/modules/<domain>` — model, service (business rules), routes (thin HTTP layer). Current modules: `auth`, `users`, `roles`, `audit`, `courses` (+ categories), `settings`.
- `src/integrations/email` — `EmailSender` interface with SMTP, console (dev) and memory (test) adapters.
- Responses: `{ success: true, data, meta? }` or `{ success: false, error: { code, message, fields?, requestId } }`.

### Key decisions

| Decision                                                                    | Reason                                                                                                                 |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Permissions resolved from the DB on every request (not embedded in the JWT) | Suspensions, role changes and logouts take effect immediately.                                                         |
| Access token bound to a session _family_ id                                 | Logout / password reset / reuse detection invalidates outstanding access tokens too.                                   |
| Refresh token rotation with reuse detection (15 s grace for parallel tabs)  | Stolen refresh tokens are detected and the whole family revoked.                                                       |
| Course state split into publication / registration / lifecycle              | Avoids one fragile status field; display status is derived (`shared/course-status.ts`).                                |
| Money stored as integer minor units                                         | No floating-point rounding errors.                                                                                     |
| Dates stored in UTC with an IANA timezone per course                        | Displays in the course's timezone (default Africa/Mogadishu), never the browser's guess.                               |
| `bcryptjs` (cost 12) instead of native `bcrypt`                             | Same algorithm, no native build toolchain on Windows/CI.                                                               |
| Zod parsing of all input instead of mongoose `sanitizeFilter`               | `sanitizeFilter` also rewrites the server's own operator queries; strict schemas reject `{ $ne: … }` objects up front. |
| Transactions for multi-document writes (role assignment + audit)            | Atomicity; requires a replica set.                                                                                     |

## Frontend (`frontend`)

- `components/ui` — shadcn-style primitives (Radix + CVA + tailwind-merge). `components.json` lets `npx shadcn add` extend it.
- `components/shared` — PageHeader, SectionHeading, EmptyState, ErrorState, StatusBadge, Pagination, FormField, DataTable, confirmation dialog, toasts.
- `components/layout` — public layout (header, mobile drawer, footer driven by Site Settings) and dashboard layout (permission-generated sidebar that collapses to a drawer).
- `features/auth` — `AuthProvider` (silent refresh on load, in-memory token), `ProtectedRoute`, `PermissionGuard`.
- `lib/api.ts` — axios instance with CSRF header, single-flight refresh on 401.
- `i18n` — i18next with English and Somali dictionaries.
- Routes are lazy-loaded; vendor code split into `react`, `data` and `i18n` chunks.
