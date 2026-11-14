# Existing Implementation Audit & Inventory

Audit baseline: commit `cb189a4` (2026-11-14). Inventory below reflects the codebase **after** iteration 2 (same day).
Baseline state before changes: typecheck clean · lint 0 errors / 8 warnings · 55/55 tests · production build OK · no failures found.

## Repository & environment

| Item             | State                                                                                                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Git              | Repository initialised in iteration 1; first commit `cb189a4` is the safe checkpoint. Branch `main`.                                                                                            |
| Workspaces       | `apps/api`, `apps/web`, `packages/shared` (types + validation + permissions — fulfils both `shared-types` and `shared-validation` from the recommended layout), `packages/design-tokens`        |
| Env config       | `apps/api/.env.example`; env validated by zod at boot; production refuses console email / insecure cookies                                                                                      |
| Database backups | **None configured.** Dev uses `npm run db:dev` (see KNOWN_BLOCKERS — it did not preserve data across an unclean shutdown). No production database exists yet, so no destructive migration risk. |
| Migrations       | Schema changes this iteration are additive (new collections, new optional fields). One data migration: RBAC role seeding (`seededPermissions`), idempotent and non-destructive.                 |

## Frontend routes

| Route                                                                                                                       | Status                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`, `/about`, `/courses`, `/courses/:slug`, `/programs`, `/programs/:slug`, `/instructors`, `/instructors/:id`, `/contact` | exist                                                                                                                                                                                                          |
| `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `*` (404)                                    | exist                                                                                                                                                                                                          |
| `/student/dashboard`, `/student/profile`                                                                                    | exist                                                                                                                                                                                                          |
| `/instructor/dashboard`, `/instructor/profile`, `/instructor/courses/:id/curriculum`                                        | exist (new)                                                                                                                                                                                                    |
| `/admin` (→ first permitted module), `/admin/courses[/new                                                                   | /:id                                                                                                                                                                                                           | /:id/curriculum]`, `/admin/categories`, `/admin/programs[/new | /:id]`, `/admin/instructors`, `/admin/users`, `/admin/roles`, `/admin/audit-logs`, `/admin/contact-messages`, `/admin/settings` | exist |
| **Missing**                                                                                                                 | `/webinars[/:slug]`, `/events[/:slug]`, `/news[/:slug]`, `/verify-certificate`, `/faq`, legal pages; all `/student/*` learning routes; `/admissions/*`; `/finance/*`; admin modules 01 (metrics), 08–10, 12–21 |

## Backend endpoints (`/api/v1`)

| Group       | Endpoints                                                                                                                                                                                      | Protection                                                                |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| health      | `GET /health`, `GET /health/ready`                                                                                                                                                             | public                                                                    |
| auth        | register, verify-email, resend-verification, login, refresh*, logout*, forgot-password, reset-password, `GET /auth/me`                                                                         | rate-limited; *CSRF                                                       |
| users       | `GET/PATCH /users/me`, `PATCH /users/me/password`; admin list/get/status/roles                                                                                                                 | auth + `users.*` / `roles.manage`                                         |
| roles       | `GET/POST/PATCH/DELETE /admin/roles`, `GET /admin/permissions`                                                                                                                                 | `permissions.manage` (list: any of roles/permissions/users)               |
| courses     | `GET /courses`, `/courses/:slug`, `/categories`; admin CRUD + publish/unpublish/archive; categories                                                                                            | public / `courses.*`, `categories.manage`                                 |
| curriculum  | `GET /courses/:slug/curriculum`, `GET /courses/:slug/lessons/:id/preview` (public); `/curriculum/...` sections & lessons CRUD, reorder, publish                                                | resource-level: `courses.update` **or** assigned instructor + `lessons.*` |
| programs    | `GET /programs`, `/programs/:slug`; `/admin/programs` CRUD + publish/unpublish/archive                                                                                                         | public / `programs.manage`                                                |
| instructors | `GET /instructors`, `/instructors/:id`; `GET /admin/instructors`, `PUT /admin/instructors/:userId/profile`; `GET/PUT /instructor/profile`; `GET /instructor/courses`                           | public / `instructors.*` / instructor role                                |
| media       | `POST /media`, `GET /media/:id/content`, `GET /media/:id/link`, `DELETE /media/:id`                                                                                                            | auth + purpose rules; private files via resolver or signed link           |
| contact     | `POST /contact`; `GET/PATCH /admin/contact-messages`                                                                                                                                           | rate-limited / `cms.manage` or `settings.manage`                          |
| settings    | `GET /settings/public`; `GET/PATCH /admin/settings`                                                                                                                                            | public / `settings.manage`                                                |
| audit       | `GET /admin/audit-logs`                                                                                                                                                                        | `audit_logs.read`                                                         |
| **Missing** | students/me/*, applications, enrollments, payments, assignments, submissions, attendance, webinars, speakers, registrations, events, certificates, news, announcements, notifications, reports | —                                                                         |

Spec-name compatibility: the spec lists `POST /instructor/lessons` / `PATCH /instructor/lessons/:id`; the implemented equivalents are `POST /curriculum/courses/:courseId/lessons` and `PATCH /curriculum/lessons/:id` (one router serves admins and instructors with resource-level checks). Documented here rather than duplicated.

## MongoDB models

users · roles · permissions · usersessions · onetimetokens · auditlogs · sitesettings · categories · courses · **programs** · **instructorprofiles** · **coursesections** · **lessons** · **mediaassets** · **contactmessages** (bold = new this iteration).

Indexes added: unique slug on programs; unique user on instructorprofiles; lessons by course/section/order and by referenced media; media unique storageKey + owner; contact by status/date.

## Reusable components

Exist: Button (variants), Input/Textarea/Select/Checkbox/Label, PasswordInput (new), Modal, Drawer, Badge, AlertMessage, Skeleton, Toast, PageHeader, SectionHeading, EmptyState, ErrorState, StatusBadge, Pagination, FormField, DataTable, confirm dialog, CourseCard, ProgramCard (new), InstructorCard (new), InitialsAvatar (new), ImageUploader (new), FileUploader (new), Brand, ProtectedRoute, PermissionGuard, layouts.
**Missing**: Breadcrumbs, DateTimePicker, StatsCard, SpeakerCard, WebinarCard, EventCard, CertificateCard, PaymentCard, NotificationDropdown, FilterBar (filters are inline per page), CSV export.

## Findings during this audit / iteration

| Finding                                                                                    | Severity             | Status                                                                                                     |
| ------------------------------------------------------------------------------------------ | -------------------- | ---------------------------------------------------------------------------------------------------------- |
| Image fields accepted only absolute URLs, so the app's own uploads could not be saved      | Functional           | Fixed (`assetUrlSchema`)                                                                                   |
| Public image fields could reference a private file                                         | Security (low)       | Fixed (`assertPublicAssetUrl`)                                                                             |
| Any uploader of a purpose could delete _other users'_ files of that purpose (e.g. avatars) | **Security**         | Fixed + regression test                                                                                    |
| New permission defaults would never reach existing roles                                   | Functional           | Fixed (seeding migration + tests)                                                                          |
| Dashboard showed the instructor-only "Teaching" menu to non-instructors                    | UI (API already 403) | Fixed                                                                                                      |
| Dev HMR could mount a second React tree (stale session visible)                            | Dev only             | Fixed (idempotent root)                                                                                    |
| bcrypt cost 12 in tests made the suite timing-sensitive under load                         | Test reliability     | Fixed (cost 4 only when `NODE_ENV=test`; production cost asserted)                                         |
| Disconnected forms / dead buttons                                                          | —                    | None found; the course "Apply" button is deliberately disabled with an explanation                         |
| Unprotected private endpoints                                                              | —                    | None found (every admin/curriculum/media route has auth + permission or resource checks, covered by tests) |
| Missing loading/empty/error states                                                         | —                    | None on built pages                                                                                        |
| Mobile layouts                                                                             | —                    | 10 public, 3 instructor and 10 admin screens verified at 320 px with no horizontal overflow                |
| Email integration                                                                          | Blocked              | SMTP adapter exists; no provider credentials                                                               |
| Payment integration                                                                        | Blocked              | No provider docs/credentials (and module not started)                                                      |
| Automated E2E (Playwright)                                                                 | Missing              | Browser checks this iteration were scripted manually in the in-app browser                                 |
