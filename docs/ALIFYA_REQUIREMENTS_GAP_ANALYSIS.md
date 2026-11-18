# Alifya Academy — Requirements Gap Analysis

Source of truth: `Alifya_Academy_Master_Prompt_Well_Organized.pdf` (29 pages, 18 sections, 14 phases), extended by the v3.0 brief.
Baseline audited at commit `cb189a4` (2026-11-14): typecheck clean, lint 0 errors, 55/55 tests passing, production build OK.

**Status key** — COMPLETE: implemented _and_ verified by an automated test or recorded browser check · PARTIAL · MISSING · BROKEN · UNVERIFIED · BLOCKED (external dependency).
**Priority** — P0 blocks other modules · P1 core business flow · P2 important · P3 polish.

Rows marked ▲ were changed in the current iteration; see `IMPLEMENTATION_PROGRESS.md`.

## S01 — Role & project vision (PDF p.3)

| ID     | Role | Feature                                                                             | Existing implementation                                                                  | Status   | Missing work                            | Priority | Verification  |
| ------ | ---- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------- | --------------------------------------- | -------- | ------------- |
| S01-01 | All  | Web-only MERN LMS                                                                   | React/Vite web + Express/Mongoose API monorepo                                           | COMPLETE | —                                       | —        | build + tests |
| S01-02 | All  | Experiences for visitors, students, instructors, admins, finance & admissions staff | Visitor, student (partial), admin (partial); no instructor/admissions/finance workspaces | PARTIAL  | Instructor, admissions, finance portals | P1       | —             |

## S02 — Official brand identity (p.4)

| ID     | Role | Feature                      | Existing implementation                                                                                                                                            | Status   | Missing work                                                 | Priority | Verification             |
| ------ | ---- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------ | -------- | ------------------------ |
| S02-01 | All  | Official logo, undistorted   | Bundled `frontend/public/logo.png` via `<Brand>`/`<LogoMark>` (object-contain, native aspect ratio); favicon + app icons derived; `SiteSettings.logoUrl` overrides | COMPLETE | —                                                            | P0       | logo supplied 2026-11-18 |
| S02-02 | All  | 8 brand colours as tokens    | `packages/design-tokens`, CSS vars, Tailwind theme                                                                                                                 | COMPLETE | —                                                            | —        | browser check            |
| S02-03 | All  | DM Serif Display / Manrope   | Google Fonts + Tailwind families                                                                                                                                   | COMPLETE | —                                                            | —        | browser check            |
| S02-04 | All  | Somali + English readability | i18next EN/SO, `<html lang>` switch                                                                                                                                | PARTIAL  | Somali draft needs native review; admin form strings EN-only | P2       | browser check            |
| S02-05 | All  | Font Awesome, no emoji       | FA core/solid/regular/brands/react                                                                                                                                 | COMPLETE | —                                                            | —        | code review              |

## S03 — Technology stack (p.5)

| ID     | Feature                                                                       | Existing implementation                        | Status   | Missing work                | Priority |
| ------ | ----------------------------------------------------------------------------- | ---------------------------------------------- | -------- | --------------------------- | -------- |
| S03-01 | React, Router, TS, TanStack Query, Vite, Axios, Tailwind, RHF, shadcn/ui, Zod | All present                                    | COMPLETE | —                           | —        |
| S03-02 | Node, Express, Helmet, Rate limit, REST, CORS, JWT, central errors, bcrypt    | All present (bcryptjs)                         | COMPLETE | —                           | —        |
| S03-03 | MongoDB/Mongoose, refs, indexes, aggregation, transactions                    | Present; transactions used for role assignment | PARTIAL  | Aggregation reports pending | P2       |

## S04 — Public website (p.6) — 14 required pages + homepage sections

| ID     | Feature                                                                                | Existing implementation                                                                                                                                  | Status     | Missing work                                                                     | Priority                   |
| ------ | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------- | -------------------------- |
| S04-01 | Home                                                                                   | `/` hero (CMS), featured courses, CTA                                                                                                                    | PARTIAL    | Programs, why-choose, instructors, webinars, events, testimonials, news sections | P1                         |
| S04-02 | About Alifya                                                                           | `/about` from Site Settings (intro, mission, vision, values, objectives, approach) + instructor highlights; honest empty state until content is supplied | COMPLETE ▲ | Academy must supply authentic content                                            | —                          |
| S04-03 | Courses                                                                                | `/courses` search/filters/sort/pagination                                                                                                                | COMPLETE   | —                                                                                | tests + browser            |
| S04-04 | Course Details                                                                         | `/courses/:slug` + public curriculum outline + preview-lesson dialog (non-preview lessons locked)                                                        | PARTIAL ▲  | Apply flow (Phase 7)                                                             | P1                         |
| S04-05 | Programs                                                                               | `/programs`, `/programs/:slug` (published programs, published courses only)                                                                              | COMPLETE ▲ | —                                                                                | programs.test.ts + browser |
| S04-06 | Instructors                                                                            | `/instructors`, `/instructors/:id` (public, active instructors only; real photos)                                                                        | COMPLETE ▲ | —                                                                                | programs.test.ts + browser |
| S04-07 | Webinars                                                                               | —                                                                                                                                                        | MISSING    | Phase 10                                                                         | P1                         |
| S04-08 | Webinar Details                                                                        | —                                                                                                                                                        | MISSING    | Phase 10                                                                         | P1                         |
| S04-09 | Events                                                                                 | —                                                                                                                                                        | MISSING    | Events module                                                                    | P2                         |
| S04-10 | News & Blog                                                                            | —                                                                                                                                                        | MISSING    | CMS module                                                                       | P2                         |
| S04-11 | Contact                                                                                | `/contact` form → ContactMessages + email to configured address; honeypot; admin inbox                                                                   | COMPLETE ▲ | —                                                                                | programs.test.ts + browser |
| S04-12 | Login                                                                                  | `/login` + password visibility toggle                                                                                                                    | COMPLETE ▲ | —                                                                                | tests + browser            |
| S04-13 | Register                                                                               | `/register` + password visibility toggle                                                                                                                 | COMPLETE ▲ | —                                                                                | tests + browser            |
| S04-14 | Verify Certificate                                                                     | —                                                                                                                                                        | MISSING    | Phase 12                                                                         | P1                         |
| S04-15 | Homepage: premium navigation                                                           | Home, About, Courses, Programs, Instructors, Contact; drawer below 1024 px                                                                               | PARTIAL ▲  | Webinars/Events links when those modules ship                                    | P2                         |
| S04-16 | Homepage: upcoming webinars / events / news / programs / instructors / success stories | Programs and instructor highlights added (render only with real data)                                                                                    | PARTIAL ▲  | Webinars, events, news, testimonials                                             | P2                         |
| S04-17 | Premium footer                                                                         | Settings-driven footer                                                                                                                                   | PARTIAL    | Legal links (pages missing)                                                      | P2                         |
| S04-18 | Supporting pages: forgot/reset/verify email, 404                                       | Present                                                                                                                                                  | COMPLETE   | —                                                                                | tests                      |
| S04-19 | Supporting pages: FAQ, privacy, terms, refund                                          | —                                                                                                                                                        | MISSING    | CMS legal pages (content must come from Academy)                                 | P3                         |

## S05 — Course management (p.7)

| ID     | Feature                                                                                                                           | Existing implementation                                                                  | Status                  | Missing work                   | Priority                     |
| ------ | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------- | ------------------------------ | ---------------------------- |
| S05-01 | Title, schedule, level, description, objectives, category, requirements, instructor, fee, duration, seats, start/end, publication | Course model + admin form                                                                | COMPLETE                | —                              | courses.test.ts              |
| S05-02 | Course thumbnail                                                                                                                  | Image uploader (content-sniffed, public media)                                           | COMPLETE ▲              | —                              | media.test.ts + browser      |
| S05-03 | Curriculum & lessons                                                                                                              | Sections + ordered text/video/PDF lessons, resources, previews, draft/published, reorder | COMPLETE ▲ (management) | Learner consumption in Phase 8 | curriculum.test.ts + browser |
| S05-04 | 7 statuses                                                                                                                        | Derived from 3 state dimensions                                                          | COMPLETE                | —                              | shared + API tests           |
| S05-05 | Browse, search, filter, view details                                                                                              | Public catalogue                                                                         | COMPLETE                | —                              | tests                        |
| S05-06 | Programs (admin)                                                                                                                  | CRUD, link courses, publish/unpublish/archive (audited)                                  | COMPLETE ▲              | —                              | programs.test.ts + browser   |
| S05-07 | Categories                                                                                                                        | CRUD + active flag                                                                       | COMPLETE                | View associated courses count  | P3                           |

## S06 — Student authentication & registration (p.8)

| ID     | Feature                                                         | Existing implementation        | Status    | Missing work                                         | Priority      |
| ------ | --------------------------------------------------------------- | ------------------------------ | --------- | ---------------------------------------------------- | ------------- |
| S06-01 | Registration / login / email verification / reset / secure auth | Full implementation            | COMPLETE  | —                                                    | 16 auth tests |
| S06-02 | Student profile + account settings                              | `/student/profile`             | COMPLETE  | StudentProfiles collection (extra fields)            | P2            |
| S06-03 | Profile image                                                   | `avatar` upload purpose in API | PARTIAL ▲ | Student profile-photo UI + `avatarUrl` save endpoint | P2            |
| S06-04 | Register for courses and webinars with account                  | —                              | MISSING   | Phases 7 & 11                                        | P1            |
| S06-05 | Prevent access to private student info                          | Per-request authz              | COMPLETE  | Resource checks for new modules                      | tests         |

## S07 — Course application & payment (p.9)

| ID     | Feature                                                                                    | Status                                   | Missing work                                   | Priority |
| ------ | ------------------------------------------------------------------------------------------ | ---------------------------------------- | ---------------------------------------------- | -------- |
| S07-01 | Selection → login → application → payment → verification → admission → enrollment → access | MISSING                                  | Whole workflow (Phase 7)                       | P1       |
| S07-02 | EVC Plus / Zaad / Sahal                                                                    | BLOCKED                                  | No official API docs, credentials or contracts | P1       |
| S07-03 | Bank transfer (if approved), manual verification                                           | MISSING                                  | Manual flow + finance review                   | P1       |
| S07-04 | Transaction references, receipts (PDF), history, failed handling, refunds                  | MISSING                                  | Phase 7                                        | P1       |
| S07-05 | Payment status separate from admission; never mark unverified as success                   | MISSING (design decided in shared enums) | Phase 7                                        | P1       |

## S08 — Student learning dashboard (p.10)

| ID     | Feature                                                                      | Status   | Missing work                       | Priority |
| ------ | ---------------------------------------------------------------------------- | -------- | ---------------------------------- | -------- |
| S08-01 | Dashboard overview                                                           | PARTIAL  | Real metrics once enrolments exist | P1       |
| S08-02 | My courses, course lessons, video lessons, PDF resources, learning materials | MISSING  | Phase 8 (depends on S05-03, S07)   | P1       |
| S08-03 | Assignments, submissions                                                     | MISSING  | Phase 8/9                          | P1       |
| S08-04 | Learning progress, attendance                                                | MISSING  | Phase 8/9                          | P1       |
| S08-05 | Payment history, receipts                                                    | MISSING  | Phase 7                            | P1       |
| S08-06 | Certificates, webinar registrations, notifications                           | MISSING  | Phases 11–12                       | P1       |
| S08-07 | Profile settings                                                             | COMPLETE | —                                  | browser  |
| S08-08 | Only authorised courses accessible                                           | MISSING  | Enrollment checks                  | P0       |

## S09 — Instructor dashboard (p.11)

| ID     | Feature                                         | Status                                                              | Missing work                                      | Priority |
| ------ | ----------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------- | -------- |
| S09-01 | View assigned courses                           | `/instructor/dashboard` (assigned only) + weekly schedule           | COMPLETE ▲                                        | —        | curriculum.test.ts + browser |
| S09-02 | Manage assigned lessons, upload materials       | Curriculum manager scoped to assigned courses; private lesson files | COMPLETE ▲                                        | —        | curriculum.test.ts + browser |
| S09-03 | Assignments, review submissions, feedback       | MISSING                                                             | Phase 9                                           | P1       |
| S09-04 | Attendance, progress, completion recommendation | MISSING                                                             | Phase 9                                           | P1       |
| S09-05 | No admin functions unless authorised            | PARTIAL                                                             | Role defaults correct; resource checks per module | P0       |

## S10 — Webinar management system (p.12–20) — major requirement

| ID      | Feature                                                                                                                                      | Status                                    | Missing work                         | Priority |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------ | -------- |
| S10A-01 | Webinar info (title, language, subtitle, thumbnail, description, poster, category, featured image, topic)                                    | MISSING                                   | Phase 10                             | P1       |
| S10A-02 | Multiple speakers with name/title/photo/bio/expertise/org/socials                                                                            | MISSING                                   | WebinarSpeakers + photo upload       | P1       |
| S10A-03 | Speaker photo upload/preview/replace/remove; shown on card & details; no placeholder when photo exists                                       | MISSING                                   | Media + UI                           | P1       |
| S10A-04 | Date, start/end, duration, timezone (Africa/Mogadishu default), registration open/close, status; correct local display; publish ≠ event date | MISSING (timezone helpers exist & tested) | Phase 10                             | P1       |
| S10A-05 | Online / physical / hybrid formats; private meeting links hidden                                                                             | MISSING                                   | Phase 10                             | P1       |
| S10A-06 | Registration settings (free/paid, fee, max, deadline, account, guest, confirmation, status)                                                  | MISSING                                   | Phase 10–11                          | P1       |
| S10A-07 | Draft, preview, publish, edit, unpublish, cancel, archive; only published public                                                             | MISSING                                   | Phase 10                             | P1       |
| S10B-01 | Featured webinar section                                                                                                                     | MISSING                                   | Phase 10                             | P1       |
| S10B-02 | Upcoming webinar cards with speaker photo/name                                                                                               | MISSING                                   | Phase 10                             | P1       |
| S10B-03 | Webinar details page                                                                                                                         | MISSING                                   | Phase 10                             | P1       |
| S10B-04 | 7 status states, cancellation precedence                                                                                                     | MISSING                                   | Phase 10                             | P1       |
| S10B-05 | Countdown (days/h/m/s) in event timezone, stops at start                                                                                     | MISSING                                   | Phase 10                             | P1       |
| S10B-06 | Registration workflow, free vs paid verification, confirmation email, dashboard listing, joining instructions                                | MISSING                                   | Phase 11                             | P1       |
| S10C-01 | Admin registrations: list, payment status, search, approve/cancel, filters, export, attendance, details, announcements                       | MISSING                                   | Phase 11                             | P1       |
| S10C-02 | Statuses Pending/Confirmed/Payment Pending/Payment Verified/Cancelled/Attended/Absent                                                        | MISSING                                   | Separate lifecycle fields            | P1       |
| S10C-03 | Duplicate prevention                                                                                                                         | MISSING                                   | Unique index                         | P1       |
| S10D-01 | 8 notification types, email + in-app, only confirmed registrations                                                                           | MISSING                                   | Persistent job queue + notifications | P1       |
| S10E-01 | Webinar analytics (8 metrics) + per-webinar report                                                                                           | MISSING                                   | Aggregations                         | P2       |

## S11 — Digital certificates (p.21)

| ID     | Feature                                                                           | Status                                     | Missing work                  | Priority |
| ------ | --------------------------------------------------------------------------------- | ------------------------------------------ | ----------------------------- | -------- |
| S11-01 | Completion requirements, approval, auto-generation after approval                 | MISSING                                    | Phase 12                      | P1       |
| S11-02 | Unique ID, branding, authorised signature, name, QR, course, PDF, completion date | MISSING / BLOCKED (logo, signature assets) | PDF + QR; assets from Academy | P1       |
| S11-03 | Public verification page; student dashboard access                                | MISSING                                    | Phase 12                      | P1       |

## S12 — Admin dashboard (p.22) — 24 modules

| #   | Module                | Existing implementation                                                       | Status     | Missing work                                                | Priority                    |
| --- | --------------------- | ----------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------- | --------------------------- |
| 01  | Dashboard overview    | `/admin` redirects to first module (no fake metrics)                          | PARTIAL    | Live aggregated metrics                                     | P2                          |
| 02  | Students              | Generic `/admin/users` filterable by role                                     | PARTIAL    | Student-specific views (enrolments, applications, progress) | P2                          |
| 03  | Instructors           | `/admin/instructors`: profiles, photo upload, public toggle, assigned courses | PARTIAL ▲  | Create-instructor-account flow                              | P2                          |
| 04  | Staff                 | Users list + roles + status                                                   | PARTIAL    | Create staff account flow                                   | P2                          |
| 05  | Courses               | Full CRUD + lifecycle + image upload + curriculum manager                     | PARTIAL ▲  | Enrolled students, course stats (Phase 7)                   | P1                          |
| 06  | Categories            | CRUD                                                                          | COMPLETE   | —                                                           | tests                       |
| 07  | Programs              | `/admin/programs` list + editor                                               | COMPLETE ▲ | —                                                           | programs.test.ts + browser  |
| 08  | Applications          | —                                                                             | MISSING    | Phase 7                                                     | P1                          |
| 09  | Enrollments           | —                                                                             | MISSING    | Phase 7                                                     | P1                          |
| 10  | Payments              | —                                                                             | MISSING    | Phase 7                                                     | P1                          |
| 11  | Lessons               | Per-course curriculum manager                                                 | PARTIAL ▲  | Cross-course lessons overview                               | P2                          |
| 12  | Assignments           | —                                                                             | MISSING    | Phase 9                                                     | P1                          |
| 13  | Webinars              | —                                                                             | MISSING    | Phase 10                                                    | P1                          |
| 14  | Webinar speakers      | —                                                                             | MISSING    | Phase 10                                                    | P1                          |
| 15  | Webinar registrations | —                                                                             | MISSING    | Phase 11                                                    | P1                          |
| 16  | Events                | —                                                                             | MISSING    |                                                             | P2                          |
| 17  | Certificates          | —                                                                             | MISSING    | Phase 12                                                    | P1                          |
| 18  | News & blog           | —                                                                             | MISSING    |                                                             | P2                          |
| 19  | Announcements         | —                                                                             | MISSING    |                                                             | P2                          |
| 20  | Notifications         | —                                                                             | MISSING    |                                                             | P2                          |
| 21  | Reports & analytics   | —                                                                             | MISSING    |                                                             | P2                          |
| 22  | Roles & permissions   | Role CRUD + matrix + assignment; v3 keys with one-time migration              | COMPLETE ▲ | —                                                           | rbac + seed-migration tests |
| 23  | Audit logs            | Viewer with action filter                                                     | PARTIAL    | Actor/date filters, export                                  | P2                          |
| 24  | System settings       | Branding, contact, social, hero                                               | PARTIAL    | Payment, email, certificate, module toggles                 | P2                          |

## S13 — Database design (p.23–24) — 25 collections

| #   | Collection                                   | Status     | Notes                                                   |
| --- | -------------------------------------------- | ---------- | ------------------------------------------------------- |
| 1   | Users                                        | COMPLETE   | `users`                                                 |
| 2   | Roles                                        | COMPLETE   | `roles`                                                 |
| 3   | Permissions                                  | COMPLETE   | `permissions` (synced from catalogue)                   |
| 4   | StudentProfiles                              | MISSING    | P2                                                      |
| 5   | InstructorProfiles                           | COMPLETE ▲ | `instructorprofiles`                                    |
| 6   | Courses                                      | COMPLETE   | `courses`                                               |
| 7   | Categories                                   | COMPLETE   | `categories`                                            |
| 8   | Programs                                     | COMPLETE ▲ | `programs`                                              |
| 9   | Applications                                 | MISSING    | Phase 7                                                 |
| 10  | Enrollments                                  | MISSING    | Phase 7                                                 |
| 11  | Payments                                     | MISSING    | Phase 7                                                 |
| 12  | Lessons                                      | COMPLETE ▲ | `lessons` (soft delete)                                 |
| 13  | Assignments                                  | MISSING    | Phase 9                                                 |
| 14  | Submissions                                  | MISSING    | Phase 9                                                 |
| 15  | LessonProgress                               | MISSING    | Phase 8                                                 |
| 16  | Webinars                                     | MISSING    | Phase 10 (required field list recorded in WEBINAR spec) |
| 17  | WebinarSpeakers                              | MISSING    | Phase 10                                                |
| 18  | WebinarRegistrations                         | MISSING    | Phase 11                                                |
| 19  | Events                                       | MISSING    | P2                                                      |
| 20  | Certificates                                 | MISSING    | Phase 12                                                |
| 21  | NewsPosts                                    | MISSING    | P2                                                      |
| 22  | Announcements                                | MISSING    | P2                                                      |
| 23  | Notifications                                | MISSING    | P2                                                      |
| 24  | AuditLogs                                    | COMPLETE   | `auditlogs`                                             |
| 25  | SiteSettings                                 | COMPLETE   | `sitesettings`                                          |
| +   | UserSessions, OneTimeTokens                  | COMPLETE   | supporting                                              |
| +   | CourseSections, MediaAssets, ContactMessages | COMPLETE ▲ | supporting                                              |

## S14 — File & image management (p.25)

| ID     | Feature                                                                                                    | Status                                                                         | Missing work                                                         | Priority |
| ------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------- | -------- |
| S14-01 | Uploads for logo, banners, thumbnails, lesson docs, instructor/speaker photos, PDFs, certificates, posters | COMPLETE ▲ (purposes defined for all; webinar/event UIs pending their modules) | —                                                                    | P0       |
| S14-02 | Validate type (content sniffing), size, ownership, access                                                  | COMPLETE ▲                                                                     | media.test.ts                                                        | P0       |
| S14-03 | Metadata & URLs in MongoDB; no large binaries in documents                                                 | COMPLETE ▲                                                                     | `mediaassets` + storage driver                                       | P0       |
| S14-04 | Object storage (S3-compatible)                                                                             | BLOCKED                                                                        | No bucket/credentials; local-disk driver behind the same interface ▲ | P1       |

## S15 — Security & code quality (p.26)

| ID     | Feature                                                                                             | Status     | Notes                                                               |
| ------ | --------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------- |
| S15-01 | JWT, hashing, errors, RBAC, audit, route protection, env vars, validation, Helmet, rate limit, CORS | COMPLETE   | 34 API tests incl. escalation and injection                         |
| S15-02 | Secure file uploads                                                                                 | COMPLETE ▲ | sniffing, limits, purpose permissions, private files + signed links |
| S15-03 | Payment verification; never trust frontend payment/role/admission                                   | MISSING    | Phase 7                                                             |
| S15-04 | Private webinar link access control                                                                 | MISSING    | Phase 10–11                                                         |

## S16 — UI/UX design (p.27)

| ID     | Feature                                                                                                          | Status  | Notes                                                       |
| ------ | ---------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------- |
| S16-01 | Premium/minimal look, brand colours, no fake stats, no emoji                                                     | PARTIAL | applied to built screens                                    |
| S16-02 | Interfaces for webinar catalog/details, payment pages, speaker profiles, certificate pages, instructor dashboard | MISSING | depend on modules                                           |
| S16-03 | Responsive every screen                                                                                          | PARTIAL | 9 built pages verified at 375 px; full width matrix pending |

## S17 — Development workflow, 14 phases (p.28)

| Phase                                   | Status                                                                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Requirements & architecture           | COMPLETE ▲ (this document + EXISTING_IMPLEMENTATION_AUDIT.md)                                                                               |
| 2 Brand design system                   | PARTIAL (logo blocked; uploader/date-time picker/stats card pending)                                                                        |
| 3 Public website UI/UX                  | PARTIAL ▲ (9 of 14 core pages complete: Home*, About, Courses, Course Details*, Programs, Instructors, Contact, Login, Register — *partial) |
| 4 Backend & database architecture       | PARTIAL ▲ (10 of 25 required collections + 6 supporting)                                                                                    |
| 5 Authentication & user management      | COMPLETE (profile image pending)                                                                                                            |
| 6 Course management                     | COMPLETE ▲ (enrolled-student views move to Phase 7)                                                                                         |
| 7 Enrollment & payment                  | MISSING (provider integrations BLOCKED)                                                                                                     |
| 8 Student learning portal               | MISSING                                                                                                                                     |
| 9 Instructor dashboard                  | PARTIAL ▲ (courses, schedule, curriculum, profile; assignments/grading/attendance pending)                                                  |
| 10 Webinar management                   | MISSING                                                                                                                                     |
| 11 Webinar registration & notifications | MISSING                                                                                                                                     |
| 12 Certificate management               | MISSING                                                                                                                                     |
| 13 Admin dashboard & analytics          | PARTIAL                                                                                                                                     |
| 14 Testing, security & deployment       | PARTIAL (unit+integration; no E2E/CI/deploy)                                                                                                |

## S18 — Final expectation (p.29)

| ID     | Expectation                                                                           | Status   |
| ------ | ------------------------------------------------------------------------------------- | -------- |
| S18-01 | Admins publish courses                                                                | COMPLETE |
| S18-02 | Upload webinar posters, speaker photos, configure webinar dates, manage registrations | MISSING  |
| S18-03 | Verify payments, teach students, issue certificates                                   | MISSING  |
| S18-04 | Visitor discovers webinar, sees presenter, time, registers                            | MISSING  |
| S18-05 | Student manages courses, payments, progress, webinars, certificates from one account  | PARTIAL  |
| S18-06 | Admin manages entire system from one dashboard                                        | PARTIAL  |

## Prioritised completion order (dependency-driven)

1. **P0 foundations** — media uploads; curriculum (sections/lessons); v3 permission keys; resource-level checks.
2. Programs, instructor profiles, public About/Programs/Instructors/Contact.
3. Phase 7 — applications, manual payments, finance verification, transactional enrollment, receipts, refunds (provider APIs BLOCKED).
4. Phase 8–9 — student learning portal, instructor portal, assignments, attendance, progress.
5. Phase 10–11 — webinars, speakers, registrations, persistent notification jobs.
6. Phase 12 — certificates.
7. Events, CMS (news, announcements, legal pages), notifications, reports, settings, overview metrics.
8. Phase 14 — Playwright E2E, CI, deployment, backup/restore drill.
