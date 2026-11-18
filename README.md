<p align="center">
  <img src="frontend/public/logo.png" alt="Alifya Academy logo" width="160" />
</p>

<h1 align="center">Alifya Academy</h1>

<p align="center">
  Learning Management &amp; Educational Operations Platform<br />
  MongoDB · Express · React · Node.js — written in TypeScript
</p>

---

> **Project status:** in active development, **not production-ready yet**. What is implemented and verified is
> tracked in [`docs/IMPLEMENTATION_PROGRESS.md`](docs/IMPLEMENTATION_PROGRESS.md); requirement-by-requirement status in
> [`docs/ALIFYA_REQUIREMENTS_GAP_ANALYSIS.md`](docs/ALIFYA_REQUIREMENTS_GAP_ANALYSIS.md); outside dependencies in
> [`docs/KNOWN_BLOCKERS.md`](docs/KNOWN_BLOCKERS.md).

## Table of contents

1. [Overview](#1-overview)
2. [Features](#2-features)
3. [Technology stack](#3-technology-stack)
4. [System requirements](#4-system-requirements)
5. [Folder structure](#5-folder-structure)
6. [Quick start](#6-quick-start)
7. [Clone from GitHub](#7-clone-from-github)
8. [Installation](#8-installation)
9. [Environment configuration](#9-environment-configuration)
10. [Database setup](#10-database-setup)
11. [Database seeding](#11-database-seeding)
12. [Development](#12-development)
13. [Production build](#13-production-build)
14. [Production start](#14-production-start)
15. [Complete bootstrap](#15-complete-bootstrap)
16. [Available commands](#16-available-commands)
17. [Troubleshooting](#17-troubleshooting)
18. [Security guidelines](#18-security-guidelines)
19. [Contributing on GitHub](#19-contributing-on-github)
20. [Deployment notes](#20-deployment-notes)

---

## 1. Overview

Alifya Academy is a web platform for running an academy: publishing courses and programs, presenting instructors,
registering and authenticating learners, and giving staff an administration area with fine-grained, role-based
permissions. It consists of:

- **`backend/`** — a REST API (`/api/v1`) built with Express and Mongoose on MongoDB.
- **`frontend/`** — a single-page web app built with React, Vite and Tailwind CSS (English and Somali).
- **`packages/`** — code shared by both: permission catalogue, enums, validation schemas, DTO types and the
  official design tokens (colours, fonts).

The backend is authoritative: permissions, statuses and validation are enforced server-side; the frontend only
mirrors them for a better experience.

### Brand and design system

- **Logo:** the official logo lives in `frontend/public/logo.png`; favicons and app icons are derived from it.
- **Colours** (`packages/design-tokens/src/tokens.css`): deep green `#17332C` for identity and primary
  actions, warm peach `#DCA477` as a restrained accent, white and soft ivory surfaces. Every colour is a CSS
  variable with a light and a dark value, so components never hard-code colours.
- **Typography:** Plus Jakarta Sans for headings, Inter for body text.
- **Shape:** 8 / 12 / 16 / 24 px radius scale, subtle borders, minimal shadows, short (≤ 250 ms) motion that
  is disabled for users who prefer reduced motion.

## 2. Features

Discovered in the codebase (see `docs/` for details and test coverage):

**Accounts & security**

- Registration without account enumeration, email verification, login with lockout after repeated failures
- Short-lived JWT access token kept in memory + rotating refresh token in an `HttpOnly` cookie with reuse detection
- CSRF double-submit protection, logout (revokes the whole session family), forgot / reset / change password
- Rate limiting, Helmet security headers, strict CORS allow-list, zod validation of every request
- Audit log of security-relevant and administrative actions

**Roles & permissions (RBAC)**

- 55 permissions and 7 system roles: student, instructor, admissions officer, finance officer, content manager,
  academy admin, super admin
- Administrators can tune role permissions and create custom roles; changes take effect immediately

**Academic content**

- Courses with lifecycle (draft → published → archived), categories, pricing, schedules and public filters
- Curriculum: sections and ordered text / video / PDF lessons, resources, free-preview lessons
- Programs, instructor profiles (public directory + self-service), contact form with admin inbox

**Learning roadmaps (signature feature)**

- Guided learning journeys drawn as an interactive **winding road** (SVG): numbered milestones, stage
  cards, start/finish landmarks and a detail drawer per stage (objectives, prerequisites, courses)
- Built from real data: each stage groups existing courses; only published roadmaps and published courses
  are shown publicly. Managed in Admin → Roadmaps (`learning_paths.manage`), with draft/publish/archive
- Keyboard and screen-reader accessible (every stage is a button in an ordered list, state is announced),
  responsive without horizontal scrolling, and the road animation respects reduced-motion settings

**Webinars**

- Public `/webinars` page with a featured banner in the official poster style, Upcoming / Past tabs, search
  and topic filters; detail pages with poster, speakers, agenda, date and time in the event's time zone
- Free registration for signed-in users: one registration per person (enforced by a unique index),
  optional capacity with atomic seat counting, self-cancellation, and statuses Registration open / Closed /
  Live / Completed / Cancelled
- **Meeting links stay private:** never in public responses; a registered participant sees the link and
  passcode only from N minutes before the start until the end (recordings after the end)
- Admin → Webinars: create and edit (poster and speaker photo uploads), publish, cancel, view registrations
  and record attendance — each action guarded by its own permission (`webinars.create`, `webinars.update`,
  `webinars.publish`, `webinars.cancel`, `webinar_registrations.manage`)
- No Zoom API integration: staff paste the meeting link. Paid webinars are not supported yet (they will
  reuse the course payment flow once it exists)

**Media**

- Content-sniffed uploads (type decided by file bytes, not the extension), per-purpose size/type rules,
  public vs. private storage with short-lived signed links

**Web app**

- Light / Dark / System colour themes (remembered per browser, applied before first paint)

- Public site: home, courses, course detail, programs, instructors, about, contact
- Dashboards for students, instructors and administrators; site settings CMS (name, logo, hero, about, contact, social)
- English / Somali interface, responsive layout, accessible forms

## 3. Technology stack

| Layer    | Technology (version in `package-lock.json`)                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------ |
| Language | TypeScript 5.7 (strict)                                                                                      |
| Backend  | Node.js ≥ 20.11, Express 4.22, Mongoose 8.24, zod, jsonwebtoken, bcryptjs, multer, pino, nodemailer          |
| Database | MongoDB **replica set** (transactions are used) — local, Docker or MongoDB Atlas                             |
| Frontend | React 18.3, Vite 6.4, React Router 6, TanStack Query 5, react-hook-form, Tailwind CSS 3.4, Radix UI, i18next |
| Tests    | Vitest 3, Supertest, mongodb-memory-server (in-memory replica set), Testing Library                          |
| Tooling  | npm workspaces, ESLint 9, Prettier 3, tsx, tsup, concurrently                                                |
| CI       | GitHub Actions (`.github/workflows/ci.yml`)                                                                  |

## 4. System requirements

| Requirement | Version / notes                                                                                                |
| ----------- | -------------------------------------------------------------------------------------------------------------- |
| Git         | any recent version                                                                                             |
| Node.js     | **20.11 or newer** (developed and tested on 22.14) — <https://nodejs.org>                                      |
| npm         | **10 or newer** (ships with Node.js 20+)                                                                       |
| MongoDB     | a **replica set**, version 6+ — _or_ nothing at all for local development: `npm run db:dev` starts one for you |
| Disk        | ~1 GB for dependencies; the first `npm run db:dev` / `npm test` downloads a MongoDB binary (~100 MB, cached)   |

No other runtime services are required for development (emails are printed to the API log).

## 5. Folder structure

```text
alifya-academy/
├── backend/                     Express + Mongoose REST API (workspace @alifya/api)
│   ├── src/
│   │   ├── app.ts               Express app: middleware + /api/v1 routes
│   │   ├── server.ts            Process entry point (connects DB, syncs RBAC, listens)
│   │   ├── config/              Validated environment (env.ts) and logger
│   │   ├── database/            Connection + system-data seeding/verification (seed.ts)
│   │   ├── integrations/        Email and file-storage drivers
│   │   ├── middleware/          Authentication, authorisation, security, validation, errors
│   │   ├── modules/             Feature modules: auth, users, roles, courses, curriculum, media, …
│   │   ├── scripts/             CLI: seed, verify-seed, create-admin, check
│   │   ├── test/                Test bootstrap (in-memory replica set)
│   │   └── utils/
│   ├── .env.example             Backend configuration template
│   ├── package.json
│   ├── tsconfig.json · tsup.config.ts · vitest.config.ts
│
├── frontend/                    React + Vite web app (workspace @alifya/web)
│   ├── public/                  logo.png (official logo), favicon.ico, app icons, site.webmanifest
│   ├── src/
│   │   ├── components/          Layouts, shared components (Brand/LogoMark), UI primitives
│   │   ├── features/            Auth, route guards, course widgets, roadmap (winding road), theme
│   │   ├── pages/               Public, student, instructor and admin pages
│   │   ├── routes/ · lib/ · i18n/ · styles/
│   ├── .env.example             Frontend (dev server) configuration template
│   ├── index.html · package.json · vite.config.ts · tailwind.config.ts
│
├── packages/
│   ├── shared/                  @alifya/shared — permissions, enums, zod schemas, API types
│   └── design-tokens/           @alifya/design-tokens — official palette and typography
│
├── scripts/
│   ├── setup.mjs                npm run setup
│   ├── bootstrap.mjs            npm run bootstrap
│   └── dev-mongo.mjs            npm run db:dev (local MongoDB replica set)
│
├── docs/                        Architecture, security, roles, requirements and progress
├── .github/workflows/ci.yml     Typecheck, lint, test and build on every push / PR
├── package.json                 Root scripts + npm workspaces
└── README.md
```

## 6. Quick start

```bash
git clone https://github.com/mohamed-hassan1234/alifya-academy.git
cd alifya-academy
npm install
npm run db:dev        # terminal 1 — leave running (skip if you have your own MongoDB replica set)
npm run bootstrap     # terminal 2 — setup + seed + verify
npm run admin:create  # create your first Super Administrator
npm run dev           # open http://localhost:5173
```

The sections below explain every step.

## 7. Clone from GitHub

```bash
git clone https://github.com/mohamed-hassan1234/alifya-academy.git
cd alifya-academy
```

## 8. Installation

```bash
npm install
```

Installs the dependencies of every workspace (`backend`, `frontend`, `packages/*`) in one go using
[npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces) and links the shared packages.

```bash
npm run setup
```

Prepares your machine. It is safe to run any number of times and:

1. checks your Node.js and npm versions;
2. runs `npm install` if any workspace is missing dependencies;
3. creates `backend/.env` and `frontend/.env` from their `.env.example` templates **only if they don't exist yet**
   — a new `backend/.env` receives a freshly generated, random `JWT_ACCESS_SECRET`. Existing `.env` files are
   never modified;
4. validates `backend/.env` with the same rules the API uses at startup;
5. checks that MongoDB is reachable and is a replica set;
6. tells you exactly what is left to do. It says **"Setup complete"** only when configuration _and_ database are ready.

## 9. Environment configuration

Configuration lives in two **local, uncommitted** files created from committed templates:

| File            | Template                | Used by                                             |
| --------------- | ----------------------- | --------------------------------------------------- |
| `backend/.env`  | `backend/.env.example`  | the API and the seed/admin scripts                  |
| `frontend/.env` | `frontend/.env.example` | the Vite dev / preview server (ports and API proxy) |

`npm run setup` creates both. To create them by hand:

**macOS / Linux**

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # paste into JWT_ACCESS_SECRET
```

**Windows PowerShell**

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # paste into JWT_ACCESS_SECRET
```

Values set in your shell take precedence over the `.env` files. An empty value (`KEY=`) counts as "not set".

### Backend variables (`backend/.env`)

| Variable                                                              | Required    | Default                                           | Description                                                                 |
| --------------------------------------------------------------------- | ----------- | ------------------------------------------------- | --------------------------------------------------------------------------- |
| `NODE_ENV`                                                            | no          | `development`                                     | `development`, `test` or `production`                                       |
| `PORT`                                                                | no          | `4000`                                            | API port                                                                    |
| `LOG_LEVEL`                                                           | no          | `info`                                            | `fatal` … `trace`, or `silent`                                              |
| `TRUST_PROXY`                                                         | no          | `0`                                               | Number of reverse-proxy hops in front of the API (e.g. `1` behind nginx)    |
| `MONGODB_URI`                                                         | no          | `mongodb://127.0.0.1:27017/alifya?replicaSet=rs0` | MongoDB connection string — must point to a **replica set**                 |
| `WEB_ORIGINS`                                                         | no          | `http://localhost:5173`                           | Comma-separated browser origins allowed by CORS                             |
| `APP_URL`                                                             | no          | `http://localhost:5173`                           | Public URL of the web app (used in email links)                             |
| `JWT_ACCESS_SECRET`                                                   | **yes**     | —                                                 | ≥ 32 random characters; signs access tokens                                 |
| `ACCESS_TOKEN_TTL_SECONDS`                                            | no          | `900`                                             | Access-token lifetime (60–3600)                                             |
| `REFRESH_TOKEN_TTL_DAYS`                                              | no          | `14`                                              | Refresh-token lifetime (1–90)                                               |
| `COOKIE_SECURE`                                                       | no          | `true` in production                              | Secure cookies; cannot be `false` in production                             |
| `EMAIL_PROVIDER`                                                      | no          | `console`                                         | `console` (prints emails to the log; refused in production) or `smtp`       |
| `EMAIL_FROM`                                                          | no          | `Alifya Academy <no-reply@localhost>`             | Sender address                                                              |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_SECURE` | with `smtp` | —                                                 | SMTP delivery settings (`SMTP_HOST` is required when `EMAIL_PROVIDER=smtp`) |
| `STORAGE_DRIVER`                                                      | no          | `local`                                           | Upload storage driver (only `local` today)                                  |
| `STORAGE_DIR`                                                         | no          | `./storage`                                       | Upload folder, relative to `backend/`                                       |
| `SEED_SUPERADMIN_EMAIL`                                               | no          | —                                                 | Optional: first Super Administrator created by `npm run seed`               |
| `SEED_SUPERADMIN_PASSWORD`                                            | no          | —                                                 | Optional: its password (10+ chars, a letter and a number)                   |
| `SEED_SUPERADMIN_NAME`                                                | no          | `Super Administrator`                             | Optional: its display name                                                  |

In production the API refuses to start with `EMAIL_PROVIDER=console` or `COOKIE_SECURE=false`.

### Frontend variables (`frontend/.env`)

| Variable           | Default | Description                                                                       |
| ------------------ | ------- | --------------------------------------------------------------------------------- |
| `WEB_PORT`         | `5173`  | Vite dev-server port                                                              |
| `API_PORT`         | `4000`  | Backend port that `/api` is proxied to (must match `PORT` in `backend/.env`)      |
| `API_PROXY_TARGET` | —       | Optional full proxy target (e.g. an API on another machine); overrides `API_PORT` |
| `PREVIEW_PORT`     | `4173`  | Port of `npm run preview`                                                         |

The browser app always calls the API on the **same origin** at `/api/v1` (Vite proxies it in development; your web
server does it in production). This keeps the refresh-token cookie first-party, so there is deliberately no
`VITE_API_URL`. Never put secrets in frontend configuration.

## 10. Database setup

The API uses multi-document **transactions**, so MongoDB must run as a **replica set** (a single node is fine).
Choose one:

**A. Bundled development database (easiest, no install)**

```bash
npm run db:dev
```

Starts a single-node replica set on `127.0.0.1:27017` with data in `.data/mongo` (git-ignored). Leave it running in
its own terminal; stop it with Ctrl+C. It matches the default `MONGODB_URI`. Treat it as disposable — see
[`docs/KNOWN_BLOCKERS.md`](docs/KNOWN_BLOCKERS.md).

**B. Your own MongoDB**

```bash
mongod --replSet rs0 --dbpath <data-folder>
mongosh --eval "rs.initiate()"
```

Keep `MONGODB_URI=mongodb://127.0.0.1:27017/alifya?replicaSet=rs0`.

**C. MongoDB Atlas (cloud)** — Atlas clusters are replica sets. Set
`MONGODB_URI=mongodb+srv://<user>:<password>@<cluster-host>/alifya` in `backend/.env` and allow your IP in Atlas.

**Migrations.** There is no separate migration step (and no `npm run migrate`): the only data migration — keeping
the permission catalogue and system roles in sync with the code without overwriting permissions an administrator
changed — runs inside `npm run seed` and on every API start. Collections and indexes are created by Mongoose.

**First administrator.** No administrator exists until you create one — see [section 11](#11-database-seeding).

## 11. Database seeding

```bash
npm run seed
npm run seed:verify
```

`npm run seed` initialises only the **system data** the application needs; it creates **no** sample courses,
users or statistics:

| Collection     | What is seeded                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| `permissions`  | The 55-entry permission catalogue (from `packages/shared/src/permissions.ts`)                             |
| `roles`        | The 7 system roles with their default permissions; `super_admin` always holds every permission            |
| `sitesettings` | The site-settings singleton with its defaults (academy name, timezone, currency, languages)               |
| `users`        | Only if `SEED_SUPERADMIN_EMAIL` **and** `SEED_SUPERADMIN_PASSWORD` are set: the first Super Administrator |

The seed is **idempotent and non-destructive**: it upserts on the unique keys, never drops or clears a collection,
keeps permissions administrators removed from a role, and never changes an existing user's password (an existing
account with the given email is only granted the Super Administrator role). It prints a report of inserted /
updated / unchanged / removed records per step and exits with an error code if a step fails. With
`NODE_ENV=production` it refuses to run unless you add `-- --confirm-production`.

`npm run seed:verify` is **read-only** and checks: replica set, all permissions and system roles present, no
duplicates, `super_admin` has the full catalogue, every role permission and user role reference is valid, unique
indexes exist, and the site-settings singleton exists exactly once. A missing administrator is reported as a warning.

### Creating the first administrator

Recommended — interactive, the password is typed hidden and never printed:

```bash
npm run admin:create
```

Non-interactive alternative (CI/provisioning): set `SEED_SUPERADMIN_EMAIL`, `SEED_SUPERADMIN_PASSWORD` (and
optionally `SEED_SUPERADMIN_NAME`) in `backend/.env`, run `npm run seed`, then **remove the password from the file**.

### Demo accounts for every role (development only)

```bash
npm run seed:demo
```

Creates one ready-to-use sign-in per system role — `student@demo.alifya.test`, `instructor@…`,
`admissions.officer@…`, `finance.officer@…`, `content.manager@…`, `academy.admin@…` and `super.admin@…` — each
active, email-verified and holding only its role. Each gets a **random** password, and the emails, passwords, landing
page, available screens and full permission list per role are written to **`backend/demo-accounts.local.md`**
(git-ignored; passwords are never printed in the terminal).

- Safe to repeat: existing demo accounts are left as they are; only `@demo.alifya.test` accounts are ever touched.
- Lost a password? `npm run seed:demo -- --reset-passwords` gives every demo account a new one.
- Refuses to run with `NODE_ENV=production`. Never use these accounts on a server others can reach.

## 12. Development

```bash
npm run dev
```

Starts both apps with hot reload (via `concurrently`):

| App     | URL                                   |
| ------- | ------------------------------------- |
| Web app | <http://localhost:5173>               |
| API     | <http://localhost:4000/api/v1>        |
| Health  | <http://localhost:4000/api/v1/health> |

Emails (verification, password reset) are printed to the API log while `EMAIL_PROVIDER=console`. Run one side only
with `npm run dev:backend` or `npm run dev:frontend`.

## 13. Production build

```bash
npm run build
```

- `backend/dist/` — bundled API (`server.js`) plus the CLI scripts (`scripts/seed.js`, `scripts/verify-seed.js`,
  `scripts/create-admin.js`), built with tsup.
- `frontend/dist/` — static web app (HTML, JS, CSS, logo and icons), type-checked and built with Vite.

## 14. Production start

```bash
npm start
```

Starts the **API only** (`node backend/dist/server.js`, reading `backend/.env`). The API does **not** serve the web
app: publish `frontend/dist/` with a web server that also proxies `/api` to the API (see
[section 20](#20-deployment-notes)).

To try the production build locally (API + `vite preview` with the same proxy) use `npm run preview`
and open <http://localhost:4173>.

## 15. Complete bootstrap

```bash
npm run bootstrap
```

One command for a new developer machine, safe to repeat. It:

1. **refuses to run when `NODE_ENV=production`** (production is seeded deliberately, see section 20);
2. runs `npm run setup` in strict mode — versions, dependencies, `.env` files, configuration and database must all be OK;
3. notes that no separate migrations are needed;
4. runs `npm run seed`;
5. runs `npm run seed:verify`;
6. prints the next steps (`npm run admin:create`, `npm run dev`).

It stops at the first failing step and explains how to fix it. Start your database (e.g. `npm run db:dev`) first.

## 16. Available commands

All commands run from the repository root.

| Command                           | What it does                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| `npm install`                     | Install all workspace dependencies                                                    |
| `npm run setup`                   | Check prerequisites, create missing `.env` files, validate config, check the database |
| `npm run bootstrap`               | setup → seed → verify, for a development machine                                      |
| `npm run db:dev`                  | Start a local MongoDB replica set on port 27017 (development only)                    |
| `npm run seed`                    | Idempotently seed permissions, roles, site settings (and optional first admin)        |
| `npm run seed:verify`             | Read-only verification of the seeded data                                             |
| `npm run admin:create`            | Interactively create (or promote) a Super Administrator                               |
| `npm run seed:demo`               | Create demo sign-ins for every role (dev only) → `backend/demo-accounts.local.md`     |
| `npm run dev`                     | Run API and web app with hot reload                                                   |
| `npm run dev:backend`             | Run only the API                                                                      |
| `npm run dev:frontend`            | Run only the web app                                                                  |
| `npm run build`                   | Production build of API and web app                                                   |
| `npm start`                       | Start the built API (production mode depends on `NODE_ENV`)                           |
| `npm run preview`                 | Run the built API + `vite preview` locally                                            |
| `npm test`                        | All tests (shared, API integration with in-memory MongoDB, web components)            |
| `npm run typecheck`               | TypeScript checks in every workspace                                                  |
| `npm run lint`                    | ESLint                                                                                |
| `npm run format` / `format:check` | Prettier                                                                              |

Production variants of the scripts, run against the built code: `npm run seed:prod -w @alifya/api`,
`npm run seed:verify:prod -w @alifya/api`, `npm run admin:create:prod -w @alifya/api`.

## 17. Troubleshooting

| Problem                                                                                  | Solution                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`Cannot find module …` / missing dependencies**                                        | Run `npm install` from the repository root (not inside `backend/` or `frontend/`). If it persists, delete `node_modules` folders and `npm install` again.                                                                                                |
| **`Invalid environment configuration: JWT_ACCESS_SECRET …`**                             | `backend/.env` is missing or the secret is shorter than 32 characters. Run `npm run setup`, or generate one (section 9).                                                                                                                                 |
| **`Cannot connect to MongoDB` / `ECONNREFUSED 127.0.0.1:27017`**                         | Start the database (`npm run db:dev` in another terminal) or correct `MONGODB_URI`. For Atlas, allow your IP address.                                                                                                                                    |
| **`not a replica set` / `Transaction numbers are only allowed on a replica set member`** | Run MongoDB as a replica set (section 10) and include `?replicaSet=rs0` in the URI.                                                                                                                                                                      |
| **Seed fails or reports `FAILED`**                                                       | Read the step's message, fix it, and re-run `npm run seed` — it is safe to repeat. `Administrator password rejected` means the password needs 10+ characters with a letter and a number.                                                                 |
| **Duplicate key error (`E11000`)**                                                       | The seed upserts on unique keys, so it should not cause this. Run `npm run seed:verify` to find duplicates. For registration/admin it means the email already exists — use `npm run admin:create` with that email to promote the account instead.        |
| **CORS error in the browser**                                                            | Add the exact web origin (scheme + host + port) to `WEB_ORIGINS` in `backend/.env` and restart the API. In development prefer the Vite proxy (`http://localhost:5173`).                                                                                  |
| **Web app shows network errors / 502 from `/api`**                                       | The API isn't running or `API_PORT` in `frontend/.env` differs from `PORT` in `backend/.env`. `npm run setup` warns about this.                                                                                                                          |
| **`EADDRINUSE` / port already in use**                                                   | Another process uses 4000, 5173 or 27017. Stop it, or change `PORT` (and `API_PORT`), or `WEB_PORT`. Find the process: `netstat -ano \| findstr :4000` (Windows) or `lsof -i :4000` (macOS/Linux).                                                       |
| **Build fails**                                                                          | Run `npm run typecheck` to see the TypeScript errors; make sure Node.js ≥ 20.11.                                                                                                                                                                         |
| **Can't sign in / no admin**                                                             | Create one with `npm run admin:create`. New self-registered accounts must verify their email first — the verification link is printed in the API log with `EMAIL_PROVIDER=console`. After 8 failed sign-in attempts an account is locked for 15 minutes. |
| **Logged out after every reload in production**                                          | Web app and API must be served from the same HTTPS origin, with `COOKIE_SECURE` left on and `TRUST_PROXY` set.                                                                                                                                           |
| **`admin:create needs an interactive terminal`**                                         | Run it in a normal terminal, or use the `SEED_SUPERADMIN_*` variables with `npm run seed`.                                                                                                                                                               |

## 18. Security guidelines

- **Secrets stay out of Git.** `.gitignore` excludes every `.env` / `.env.*` file except the `.env.example`
  templates, plus uploads (`backend/storage/`), local database data (`.data/`), build output and logs.
- **Generated secrets.** `npm run setup` generates a random 384-bit `JWT_ACCESS_SECRET` for each new `backend/.env`.
  Use a different secret per environment; rotating it signs everyone out.
- **No hard-coded credentials.** There is no default administrator. Admin passwords are typed hidden
  (`admin:create`) or provided via environment, validated against the password policy, hashed with bcrypt and
  never printed. An existing account's password is never reset by any script.
- **Frontend holds no secrets.** Only `VITE_`-prefixed variables can reach browser code and none are used.
- **Database.** Use a dedicated MongoDB user with least privileges, restrict network access, enable backups, and
  never point development tools at the production database. Seeding production requires `--confirm-production`;
  `npm run bootstrap` refuses production entirely.
- **Production configuration** is enforced at startup (SMTP email, secure cookies). More detail in
  [`docs/SECURITY.md`](docs/SECURITY.md).
- If a secret is ever committed, **rotate it first** (changing it in Git is not enough), then remove it from the
  history.

## 19. Contributing on GitHub

```bash
git checkout -b feature/short-description     # never work directly on main
# …make changes…
npm run typecheck && npm run lint && npm test # same checks as CI
git status                                    # make sure no .env, storage or data files are listed
git add <files>
git commit -m "Describe the change"
git push -u origin feature/short-description
```

Then open a pull request on GitHub. CI (`.github/workflows/ci.yml`) runs typecheck, lint, tests and build.

## 20. Deployment notes

The codebase supports this production layout (no Docker files are included yet):

1. **MongoDB** replica set (e.g. MongoDB Atlas) with backups.
2. **API**: on the server run `npm ci`, `npm run build`, create `backend/.env` with `NODE_ENV=production`,
   a strong `JWT_ACCESS_SECRET`, `EMAIL_PROVIDER=smtp` + SMTP settings, the production `MONGODB_URI`,
   `WEB_ORIGINS`/`APP_URL` set to your domain and `TRUST_PROXY=1`. Then:
   ```bash
   npm run seed:prod -w @alifya/api -- --confirm-production
   npm run seed:verify:prod -w @alifya/api
   npm run admin:create:prod -w @alifya/api -- --confirm-production
   npm start
   ```
   Keep the process alive with a supervisor (systemd, pm2, …). Uploaded files are written to `STORAGE_DIR`; put it
   on persistent, backed-up storage.
3. **Web app**: serve `frontend/dist/` as static files from the **same HTTPS domain**, with a reverse proxy that
   forwards `/api/` to the API and falls back to `index.html` for client-side routes. Example (nginx):
   ```nginx
   location /api/ { proxy_pass http://127.0.0.1:4000; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; }
   location /     { root /srv/alifya/frontend/dist; try_files $uri /index.html; }
   ```

Outstanding external dependencies for a public launch (payments, SMTP provider, object storage, content) are listed
in [`docs/KNOWN_BLOCKERS.md`](docs/KNOWN_BLOCKERS.md).

---

<p align="center"><sub>© Alifya Academy. The logo in <code>frontend/public/logo.png</code> is the official brand asset.</sub></p>
