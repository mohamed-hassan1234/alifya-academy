# Security

## Implemented controls

**Authentication**

- Passwords: bcrypt (cost 12) via `bcryptjs`; policy ≥10 chars with a letter and a number; never logged or returned.
- Access token: HS256 JWT, 15 min, issuer/audience pinned, held in browser memory only.
- Refresh token: 48 random bytes, stored as SHA-256 hash, `HttpOnly; SameSite=Strict; Path=/api/v1/auth; Secure` (production).
- Rotation on every refresh; replay of a rotated token after a 15 s grace window revokes the whole session family.
- Every request re-checks: session family alive, account `active`, current roles → suspension/logout/role change is immediate.
- CSRF: double-submit token (`alf_csrf` cookie + `X-CSRF-Token` header) plus Origin allowlist on cookie-authenticated endpoints.
- Lockout: 8 failed logins → 15 min lock. Uniform error for unknown email vs wrong password; dummy hash equalises timing.
- Registration, resend-verification and forgot-password never reveal whether an email exists.
- Verification/reset tokens: 32 random bytes, hashed at rest, single-use (atomic consume), 24 h / 1 h expiry; password reset revokes all sessions.

**Authorization**

- Permission checks on every admin route (`requirePermission`), independent of the UI.
- Escalation guards: no self role/status edits; only super admins grant/revoke `super_admin`; non-super-admins can't grant permissions they lack; `super_admin` permissions immutable; system roles undeletable; last active super admin protected.

**Input & transport**

- All body/query/params parsed by strict zod schemas (rejects operator objects like `{ "$ne": … }`); user search text is regex-escaped.
- Helmet headers, explicit CORS allowlist, 200 kB JSON limit, global + auth rate limits, generic 500 messages with request ID.
- Logger redacts authorization headers, cookies, passwords, tokens and meeting passwords.

**Audit**

- Sensitive actions recorded with actor, action, target, outcome, IP, user agent; role assignment audit is written in the same transaction.

## Production requirements (enforced or documented)

- `NODE_ENV=production` refuses to start with console email or `COOKIE_SECURE=false`.
- Serve web and API from the same origin behind HTTPS (reverse proxy), set `TRUST_PROXY` correctly for rate limiting.
- Use a MongoDB replica set; restrict network access; enable backups.

## Not yet implemented

File-upload validation and private storage, rich-text sanitisation (CMS), payment webhook verification and idempotency, private meeting-link protection, data retention policies, and a formal penetration test — scheduled with their modules.
