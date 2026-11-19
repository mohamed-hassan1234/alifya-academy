# Implementation Progress

Requirement-level status: [`ALIFYA_REQUIREMENTS_GAP_ANALYSIS.md`](ALIFYA_REQUIREMENTS_GAP_ANALYSIS.md). Iteration 1 details: [`DEVELOPMENT_PROGRESS.md`](DEVELOPMENT_PROGRESS.md).

## Iteration 2 — 2026-11-14: v3 audit, uploads, curriculum, programs, instructors

### 1. Completed features

- Requirement-by-requirement gap analysis against the 29-page PDF; implementation audit and inventory.
- v3 permission matrix (16 new keys) with a non-destructive role migration.
- Media module: content-sniffed uploads, per-purpose size/type/permission rules, public vs private storage, short-lived signed links, owner/staff deletion, audit trail, storage-driver abstraction.
- Programs: model, admin CRUD/publish/archive, public list and detail.
- Instructor profiles: public directory and profile pages (photos, socials, published courses), admin editor, instructor self-service.
- Curriculum: sections and ordered text/video/PDF lessons with resources, preview flag, draft/published, reorder, soft delete; public outline and preview lessons; private lesson files readable by course managers.
- Instructor portal: assigned courses, weekly teaching schedule, curriculum management, professional profile.
- Public pages: About (CMS-driven), Programs, Program detail, Instructors, Instructor profile, Contact; homepage programs and instructor sections; expanded navigation.
- Admin: Programs, Instructors, Contact messages; image uploaders for course images, logo and hero; About-page content fields.
- Password show/hide toggle on all password fields.

### 2. Existing features preserved

All iteration-1 behaviour retained; every pre-existing test still passes. Category routes accept the new `categories.manage` **and** the old `courses.update` so existing custom roles keep working.

### 3. Broken features repaired

See the findings table in [`EXISTING_IMPLEMENTATION_AUDIT.md`](EXISTING_IMPLEMENTATION_AUDIT.md) — notably a file-deletion authorization bug, absolute-URL-only image fields, role-default propagation, and a sidebar visibility bug.

### 4. New frontend pages

`/about`, `/programs`, `/programs/:slug`, `/instructors`, `/instructors/:id`, `/contact`, `/instructor/dashboard`, `/instructor/profile`, `/instructor/courses/:id/curriculum`, `/admin/courses/:id/curriculum`, `/admin/programs[/new|/:id]`, `/admin/instructors`, `/admin/contact-messages`.

### 5. New backend endpoints

Media (4), programs (2 public + 6 admin), instructors (2 public + 2 admin + 3 self), curriculum (2 public + 11 management), contact (1 public + 2 admin). Full list in the audit.

### 6. Database changes

New collections: programs, instructorprofiles, coursesections, lessons, mediaassets, contactmessages. New optional fields: `roles.seededPermissions`, `sitesettings.about.{introduction,mission,vision,approach,values,objectives}`. All additive; no existing data modified except the one-time addition of new default permissions to system roles.

### 7. Design improvements

Programs/instructor cards; real-photo-first instructor display (initials only when no photo exists); curriculum accordion with lock/preview states; uploader with preview, progress, replace and remove; 6-link desktop navigation with drawer below 1024 px.

### 8–9. Tests executed and results

| Suite                                          | Result                                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `packages/shared` (unit)                       | 14/14 passed                                                                                           |
| `backend` (integration, in-memory replica set) | 58/58 passed — new: media (7), curriculum (7), programs/instructors/contact (7), seeding migration (3) |
| `frontend` (component/unit)                    | 7/7 passed                                                                                             |
| Typecheck                                      | clean                                                                                                  |
| Lint                                           | 0 errors (8 dev-only fast-refresh warnings)                                                            |
| Production build                               | passes                                                                                                 |

**Browser verification (local dev stack):** registered a new user through the UI → verified via the emailed link → admin granted the Instructor role → admin created a category and a course with a real image upload and assigned the instructor → published → instructor signed in, landed on the Teaching portal, built a section with a text preview lesson and a PDF lesson (real upload), published both → instructor published a profile with an uploaded photo → as a visitor: course outline shows both lessons, non-preview lesson locked, preview opens, PDF lesson not retrievable as preview (404), outline contains no lesson bodies → contact form validated and submitted → admin created and published a program through the UI → admin saw the contact message. Responsive sweep at 320 px: 10 public, 3 instructor and 10 admin screens with zero horizontal overflow. The instructor was shown "Access restricted" on `/admin/programs`.

Correction recorded: during this session I first reported the role migration as verified against persisted data; the dev database had in fact lost its data, so the roles were freshly created. The migration is verified by automated tests only.

### 10. Remaining incomplete requirements

Phase 7 (applications, payments, enrollment), Phase 8 (student learning portal), the rest of Phase 9 (assignments, submissions, grading, attendance, progress, completion recommendations), Phases 10–11 (webinars, speakers, registrations, notifications), Phase 12 (certificates), events, news/blog, announcements, notifications, reports, admissions/finance workspaces, student profile-photo UI, admin overview metrics, Playwright E2E, CI, deployment.

### 11. External blockers

See [`KNOWN_BLOCKERS.md`](KNOWN_BLOCKERS.md).

### 12. Next implementation steps

Phase 7 — applications & admissions workflow, manual payment submission and finance verification, transactional enrollment with seat allocation, receipts (PDF), refunds; admissions and finance workspaces. Then Phase 8 learner consumption of the curriculum built in this iteration.
