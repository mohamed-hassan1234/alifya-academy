# Alifya Academy — Learning Management & Educational Operations Platform

MERN-stack (MongoDB · Express · React · Node) monorepo in TypeScript.

> **Status:** in progress — not production-ready. Exactly what is implemented and verified:
> [`docs/IMPLEMENTATION_PROGRESS.md`](docs/IMPLEMENTATION_PROGRESS.md) · requirement-by-requirement status against the original PDF:
> [`docs/ALIFYA_REQUIREMENTS_GAP_ANALYSIS.md`](docs/ALIFYA_REQUIREMENTS_GAP_ANALYSIS.md) · external dependencies:
> [`docs/KNOWN_BLOCKERS.md`](docs/KNOWN_BLOCKERS.md) · security: [`docs/SECURITY.md`](docs/SECURITY.md).

## Repository layout

```text
apps/api              Express + Mongoose REST API (/api/v1)
apps/web              React + Vite + Tailwind + shadcn-style UI
packages/shared       Contracts shared by both apps: permissions, enums, zod schemas, DTO types, status rules
packages/design-tokens Official Alifya palette and typography tokens
scripts/dev-mongo.mjs  Local MongoDB replica set for machines without MongoDB/Docker
docs/                  Architecture, security, progress and requirement documents
```

## Prerequisites

- Node.js ≥ 20.11 (developed on 22) and npm 10
- MongoDB **replica set** (transactions are used). Locally either your own `mongod --replSet rs0`, MongoDB Atlas, or `npm run db:dev`.

## Getting started

```bash
npm install
cp apps/api/.env.example apps/api/.env      # then set JWT_ACCESS_SECRET and the SEED_SUPERADMIN_* values
npm run db:dev                              # terminal 1 — skip if you have your own MongoDB replica set
npm run seed                                # syncs permissions/roles and creates the first Super Administrator
npm run dev                                 # API on :4000, web on :5173 (Vite proxies /api)
```

Emails (verification, password reset) are printed to the API log while `EMAIL_PROVIDER=console`.

## Quality gates

```bash
npm run typecheck
npm run lint
npm test          # shared unit tests, API integration tests (in-memory replica set), web component tests
npm run build
```

## Key principles

- The backend is authoritative: permissions, fees, statuses and eligibility are enforced server-side.
- No fabricated data: empty collections render honest empty states; no sample courses or metrics are seeded.
- Unfinished workflows are not presented as working (e.g. "Apply" is disabled until the admissions module ships).
- Official logo: configure `logoUrl` in Admin → Site settings. Until then the academy name renders as text.
