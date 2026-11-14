# Development Progress

Iteration 1 log. Current status: [`IMPLEMENTATION_PROGRESS.md`](IMPLEMENTATION_PROGRESS.md) and [`ALIFYA_REQUIREMENTS_GAP_ANALYSIS.md`](ALIFYA_REQUIREMENTS_GAP_ANALYSIS.md).

## Iteration 1 — 2026-11-14: Foundation, authentication, RBAC, courses

### Completed and verified

| Area         | What exists                                                                                                                                                                                                                                                                                                                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo     | npm workspaces: `apps/api`, `apps/web`, `packages/shared`, `packages/design-tokens`; strict TS; ESLint 9 + Prettier                                                                                                                                                                                                                                                                    |
| API platform | Env validation, pino (secret redaction), Helmet, CORS allowlist, rate limits, 200 kB body limit, request IDs, consistent envelope, central errors, health/readiness                                                                                                                                                                                                                    |
| Auth         | Register (no account enumeration), email verification (hashed single-use tokens, resend), login with lockout, refresh rotation + reuse detection, CSRF double-submit, logout, forgot/reset password, change password, profile update                                                                                                                                                   |
| RBAC         | 38-permission catalogue, 7 system roles, DB-backed roles, per-request permission resolution, role CRUD, user role assignment with escalation guards (transactional + audited), status management                                                                                                                                                                                       |
| Audit        | `AuditLog` collection, written for auth events, role/permission changes, status changes, course/category changes, settings changes; admin viewer                                                                                                                                                                                                                                       |
| Courses      | Categories CRUD; course CRUD with separated publication/registration/lifecycle state; derived display status; publish/unpublish/archive; instructor assignment validation; public catalogue with search, filters, sort, pagination                                                                                                                                                     |
| Settings     | Site settings singleton (name, logo reference, contact, social, hero, about) — public read, admin update                                                                                                                                                                                                                                                                               |
| Web          | Design tokens, DM Serif Display + Manrope, Font Awesome; shadcn-style UI kit; public layout with mobile drawer; dashboard layout with permission-generated nav; home, catalogue, course detail, auth pages, 404; student overview + profile; admin courses (list + full form incl. weekly schedule), categories, users, roles/permission matrix, audit logs, site settings; EN/SO i18n |

### Tests executed (all passing)

- `packages/shared` — 14 unit tests: course status precedence, registration window/capacity, password policy, date validation, role permission validation, slugify.
- `apps/api` — 34 integration tests (Supertest + in-memory MongoDB replica set): health; register→verify→login journey; enumeration resistance; lockout; suspended accounts; token tampering; cookie flags; CSRF; refresh rotation and reuse detection revoking the family and its access token; logout; reset/change password session revocation; RBAC per role; immediate effect of role changes and suspension; super-admin escalation guards; role catalogue validation; course lifecycle, slugs, instructor validation, archive lock, date/money validation; public filters, pagination, regex and `$ne` injection.
- `apps/web` — 7 tests: money/timezone helpers (incl. regression for a date-time formatter crash found in manual testing), CourseCard rendering, FormField accessibility wiring.

### Manual verification (browser, local dev stack)

Signed in as a seeded super admin → created a category → submitted an invalid course (end before start: field error shown with `aria-invalid`) → saved a valid draft → published → course appeared in the public catalogue and detail page with dates in Africa/Mogadishu time → audit log listed every action → full page reload restored the session → no horizontal overflow at 375 px on 9 pages → EN/SO switch updated text and `<html lang>`.

Bugs found this way and fixed: audit-log page crash (invalid `Intl` option combination); noisy 403 on every anonymous page load (session restore attempted without a session).

### Known gaps / honest limitations

- **Official logo not supplied** — `logoUrl` is configurable; the name renders as text meanwhile.
- **Somali translations are a draft** and need review by a native-speaking staff member.
- Admin course form labels are English-only (not yet in the dictionaries).
- No media uploads yet: thumbnails/hero images are URLs until the media module (S3-compatible, signed URLs) exists.
- Client-side SEO tags only; no sitemap or pre-rendering yet.
- No Playwright E2E suite or CI pipeline yet; browser verification above was manual.
- The "Apply" button on course pages is intentionally disabled until the admissions module ships.
- `react-refresh/only-export-components` lint warnings (8) are dev-experience only.
- ESLint 9 is reported deprecated by npm; upgrade when convenient.

### External blockers

- EVC Plus / Zaad / Sahal: no API documentation, credentials or contracts available — payment integrations cannot be built beyond adapter interfaces.
- SMTP provider credentials needed for real email delivery (`EMAIL_PROVIDER=smtp`).
- Production MongoDB replica set (e.g. Atlas) and hosting not yet chosen.

### Next planned phase

Phase 6 completion (programs, curriculum sections/lessons, media uploads), then Phase 7 applications & admissions with transactional enrollment and seat allocation.
