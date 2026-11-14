# Roles & Permissions

Source of truth: `packages/shared/src/permissions.ts` (catalogue + default role sets). Enforcement is **always** server-side:

1. `requirePermission` / `requireAnyPermission` middleware on every staff route.
2. Resource-level checks inside services (e.g. curriculum edits require `courses.update` **or** being an assigned instructor with `lessons.*`; private files require ownership or a module resolver; profile edits require the instructor role or `instructors.manage`).
3. Permissions and account status are re-read from MongoDB on every request, so changes apply immediately.

The frontend only uses permissions/roles to shape navigation and hide unusable actions.

## Default role matrix (v3)

| Permission group                                                                 | Student | Instructor                | Admissions      | Finance   | Content mgr    | Academy admin    | Super admin |
| -------------------------------------------------------------------------------- | ------- | ------------------------- | --------------- | --------- | -------------- | ---------------- | ----------- |
| Users (`users.*`, `students.*`, `instructors.*`)                                 | —       | —                         | `students.read` | —         | —              | all except roles | all         |
| Access control (`roles.manage`, `permissions.manage`)                            | —       | —                         | —               | —         | —              | —                | ✓           |
| Courses, categories, programs                                                    | —       | —                         | `courses.read`  | —         | —              | ✓                | ✓           |
| Lessons (`lessons.manage/create/update/publish`)                                 | —       | ✓ _assigned courses only_ | —               | —         | —              | ✓                | ✓           |
| Assignments, grading, attendance                                                 | —       | ✓ _assigned courses only_ | —               | —         | —              | ✓ (no grading)   | ✓           |
| Applications & enrollments                                                       | —       | —                         | ✓               | —         | —              | ✓                | ✓           |
| Payments (`payments.*`)                                                          | —       | —                         | —               | ✓         | —              | —                | ✓           |
| Webinars, speakers, registrations, events                                        | —       | —                         | —               | —         | —              | ✓                | ✓           |
| Certificates                                                                     | —       | —                         | —               | —         | —              | ✓                | ✓           |
| Content (`cms.*`, `news.manage`, `announcements.manage`, `notifications.manage`) | —       | —                         | —               | —         | ✓ (no publish) | ✓                | ✓           |
| Reports                                                                          | —       | —                         | academic        | financial | —              | academic         | ✓           |
| Settings, audit logs                                                             | —       | —                         | —               | —         | —              | —                | ✓           |

Students and instructors act mostly through **ownership-scoped** endpoints (their own profile, assigned courses), which do not need catalogue permissions.

## Safeguards

- Nobody can change their own roles or account status.
- Only super admins can grant or revoke `super_admin`, or touch a super admin's account.
- Non-super-admins cannot grant a role holding permissions they lack themselves.
- `super_admin` always holds the full catalogue; system roles cannot be deleted.
- Role assignments are transactional and audited.

## Catalogue migrations

`seedRbac()` runs at every API start and via `npm run seed`. Each system role stores `seededPermissions` — the defaults already offered. When the catalogue gains new defaults they are added **once**; permissions an administrator removed are never re-added. Roles created before this mechanism are treated as having been offered all pre-v3 defaults (`V3_ADDED_PERMISSIONS`). Covered by `seed-migration.test.ts`.
