# Alifya Academy — Requirements Checklist

> **Superseded:** requirement status now lives in `ALIFYA_REQUIREMENTS_GAP_ANALYSIS.md` (mapped to the original PDF). This file is kept as the iteration-1 checklist.

Source: _Alifya Academy Ultimate Advanced Master Development Prompt_. Every requirement is converted into an
actionable item. Status legend:

- `[x]` implemented **and** covered by an executed automated test or manual verification (see `DEVELOPMENT_PROGRESS.md`)
- `[~]` partially implemented (details in progress log)
- `[ ]` not started

A feature counts as done only when UI, API, DB, authorization, validation, states, responsiveness, tests and docs
are all in place (§37 completion criteria).

## Foundation (Phase 2–3)

- [x] npm-workspaces monorepo: `apps/web`, `apps/api`, `packages/shared`, `packages/design-tokens`
- [x] TypeScript strict mode everywhere
- [x] Environment validation (zod) with `.env.example`
- [x] MongoDB connection with graceful shutdown
- [x] Health endpoints (`/api/v1/health`, `/api/v1/health/ready`)
- [x] Helmet, CORS allowlist, rate limiting, payload limits, centralized error handler, consistent API envelope
- [x] ESLint + Prettier
- [x] Vitest (api + web + shared), Supertest, in-memory Mongo replica set
- [x] Brand tokens (palette, typography) centralised as CSS variables + Tailwind theme
- [x] DM Serif Display + Manrope, Font Awesome icons
- [~] Reusable component library (core set done; DataTable, DateTimePicker, FileUploader, Drawer, Stepper pending)
- [ ] Official logo — **blocked: asset not supplied**. `SiteSettings.logoUrl` is the configurable reference; until set, the academy name is rendered as text (no invented logo)
- [ ] Playwright E2E harness
- [ ] CI pipeline (GitHub Actions)

## Public website (Phase 4)

- [~] Home (hero from CMS settings w/ translated defaults, dynamic featured courses, CTA; other sections await their modules)
- [ ] About (configurable content)
- [x] Course catalog: search, category, level, free/paid, registration filters, sorting, pagination, empty state
- [x] Course details (protected lessons not exposed)
- [ ] Programs / Program details
- [ ] Instructors / Instructor profiles
- [ ] Webinars / Webinar details
- [ ] Events / Event details
- [ ] News / Article details
- [ ] Contact form (backend storage)
- [x] Login, Register, Forgot password, Reset password, Email verification
- [ ] Verify certificate
- [ ] FAQ, Privacy, Terms, Refund (configurable legal pages — no invented legal text)
- [x] 404 page
- [ ] SEO: per-page meta, OG tags, sitemap, robots, structured data
- [x] Language switching EN/SO (Somali strings need native-speaker review)

## Authentication & accounts (Phase 5)

- [x] Registration (name, email, phone, password, confirm, terms)
- [x] Email verification (hashed one-time tokens, resend)
- [x] Login / logout, account lockout after repeated failures
- [x] Short-lived JWT access token (memory only) + rotating refresh token in HttpOnly SameSite=Strict cookie
- [x] Refresh-token reuse detection → whole session family revoked
- [x] CSRF double-submit token for cookie-authenticated endpoints
- [x] Forgot / reset password (one-time, revokes all sessions)
- [x] Change password, update profile
- [x] Account states: pending_verification, active, suspended, disabled (enforced per request)
- [ ] Profile image upload (needs media module)
- [x] SMTP email adapter + console/memory adapters for dev/test (production refuses console adapter)

## RBAC (Phase 5)

- [x] Permission catalogue (shared), `permissions` + `roles` collections, seed script
- [x] System roles: student, instructor, admissions_officer, finance_officer, content_manager, academy_admin, super_admin
- [x] Multiple roles per user
- [x] Backend `requirePermission` middleware; permissions resolved per request from DB
- [x] Role management API + UI (super admin), protected system roles, last-super-admin protection
- [x] User admin: list/search/filter, status changes, role assignment (audited)
- [x] Audit log model, service, viewer
- [x] Permission-aware navigation and route guards on the frontend
- [ ] Resource-level ownership checks for instructor/student resources (arrive with those modules)

## Courses & programs (Phase 6)

- [x] Course model with separated publication / registration / lifecycle state + derived display status
- [x] Categories CRUD
- [x] Admin course CRUD, publish/unpublish/archive (audited), instructor assignment
- [ ] Curriculum sections, lessons, resources
- [ ] Programs CRUD
- [ ] Thumbnail upload (media module)

## Not started (Phases 7–16)

- [ ] Applications & admissions workflow, enrollment with transactional seat allocation
- [ ] Payments: intents, provider adapters (EVC Plus / Zaad / Sahal — **blocked: no provider credentials or docs**), manual verification, receipts PDF, refunds, finance dashboard
- [ ] Student portal: lessons, progress, assignments, submissions, attendance, payments, certificates
- [ ] Instructor portal: lessons, assignments, grading, attendance, progress, completion recommendations
- [ ] Webinars: CRUD, speakers + photos, date/time/timezone, formats, capacity-safe registration, paid flow, countdown, statuses, reminders (persistent job queue), joining-link protection, attendance, analytics
- [ ] Events + registrations
- [ ] Certificates: eligibility, approval, PDF + QR, public verification, revocation
- [ ] CMS: news/blog (sanitized rich text), announcements, testimonials, SEO metadata
- [ ] Notifications: in-app + email, preferences
- [ ] Reports & analytics (aggregation pipelines), CSV/XLSX export
- [ ] Media module: S3-compatible private storage, signed URLs, MIME sniffing, image optimisation
- [ ] Feature flags enforced server-side
- [ ] Security hardening pass, accessibility audit, responsive matrix, Playwright journeys
- [ ] Deployment: Docker/hosting, backups & restore test, monitoring, rollback plan
