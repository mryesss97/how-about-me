# 08 · Security, Secrets & Audit

| Field        | Value                                                                                                                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status       | Approved (baseline v1.0)                                                                                                                                                                      |
| Source       | [00-source/02_TECHNICAL_ARCHITECTURE.md](../00-source/02_TECHNICAL_ARCHITECTURE.md) §13–§14, §22 · [00-source/04_OPERATIONS_COSTS_ROADMAP.md](../00-source/04_OPERATIONS_COSTS_ROADMAP.md) §8 |
| Requirements | NFR-010…NFR-019, FR-040…FR-046, FR-200…FR-201                                                                                                                                                 |

## 1. Trust boundaries

```text
Browser (untrusted)  ──JWT──▶  NestJS API (trusted)  ──▶  Postgres (trusted, private)
                                   │
                                   ├──▶ Threads API   (token held server-side only)
                                   └──▶ OpenAI        (key held server-side only)
```

The browser holds only: Supabase URL, **anon** key, its own session JWT, API base URL.

## 2. Authentication (JWT)

- Supabase issues access tokens (JWT, 1 h) + refresh tokens. API verifies with Supabase JWKS (`SUPABASE_URL/auth/v1/.well-known/jwks.json`, cached 10 min) or `SUPABASE_JWT_SECRET` (HS256 projects). Verify `iss` (= `${SUPABASE_URL}/auth/v1`, override `SUPABASE_JWT_ISSUER`), `aud=authenticated`, `exp` (clock tolerance 5 s). HS256 fallback is tried only when JWKS verification fails for a reason other than expiry. Tokens with `is_anonymous: true` are rejected (`AUTH_INVALID_TOKEN`). `Authorization` scheme `Bearer` is case-insensitive.
- `sub` → `user_profiles.id`. Email (lowercased) from claims; profile upsert on first call (concurrent first calls tolerated); invitation placeholders matched by email are re-keyed to `sub`. `last_login_at` is rewritten only when older than 5 minutes.
- Sign-ups disabled in Supabase dashboard; invitations by Admin (`POST /members`) → optional Supabase invite email via service-role key **server-side only** (`SUPABASE_SERVICE_ROLE_KEY` in API env, never web).
- No cookies for API auth (Bearer only) → CSRF not applicable to API; the Next.js server uses Supabase cookies solely for redirecting unauthenticated users; state-changing calls go browser → API with Bearer.

## 3. Authorization (RBAC)

- `ProjectRoleGuard` + `@Roles('admin')` etc. per [../01-product/02-personas-rbac.md](../01-product/02-personas-rbac.md).
- Project settings gates (`allowAnalystReanalyze`, `allowViewerExport`) evaluated in the guard for the specific endpoints, declared with `@AllowRoleWhenSetting(role, setting)` next to `@Roles`. Settings are loaded in the same query as membership and parsed with `ProjectSettingsSchema` (malformed JSON → defaults); a blocked gate returns `403 FORBIDDEN_ROLE` naming the setting.
- Deny by default: controllers without `@Roles` under `/projects/:projectId` require membership; controllers outside (`/me`) require a valid JWT.
- `apps/api/src/common/auth/permission-matrix.ts` is the executable copy of the personas-rbac §3 matrix (`implemented` / `planned` per route). Change both in the same PR.
- Tests: `test/integration/rbac.int-spec.ts` discovers every Nest route; a mutating `/projects/:projectId` route without `@Roles` or a matching matrix entry fails CI (TC-AUTH-012). Each `implemented` entry is exercised table-driven for admin/analyst/viewer.

## 4. Secrets inventory

| Secret                               | Location                                                                          | Access              | Rotation                                                     |
| ------------------------------------ | --------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------ |
| Threads access token (long-lived)    | `integration_secrets` encrypted; plaintext only in worker memory                  | `ThreadsTokenStore` | Admin via Settings → Integrations; refresh job               |
| Meta app secret (if OAuth flow used) | API env `THREADS_APP_SECRET`                                                      | ThreadsModule       | env change + restart                                         |
| `INTEGRATION_ENCRYPTION_KEYS`        | API env, JSON `{ "k1": "<base64 32B>" }` + `INTEGRATION_ENCRYPTION_ACTIVE_KEY=k1` | crypto service      | add `k2`, set active, run `pnpm --filter api secrets:rewrap` |
| `OPENAI_API_KEY`                     | API env                                                                           | providers           | env change                                                   |
| `DATABASE_URL`, `DIRECT_URL`         | API env                                                                           | Prisma              | Supabase dashboard                                           |
| `SUPABASE_SERVICE_ROLE_KEY`          | API env only                                                                      | invites             | Supabase dashboard                                           |
| `SUPABASE_JWT_SECRET`                | API env (if HS256)                                                                | auth                | Supabase dashboard                                           |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`      | web env (public by design)                                                        | FE                  | Supabase dashboard                                           |

Encryption: AES-256-GCM, random 12-byte IV per record, AAD = `connection_id`, `key_id` stored → rotation without downtime. Implementation in `apps/api/src/common/crypto/`.

## 5. Redaction & logging

pino `redact` paths (`REDACT_PATHS` in `apps/api/src/common/logging/logger.config.ts`, censor `[REDACTED]`): `req.headers.authorization`, `req.headers.cookie`, `req.headers["x-api-key"]`, `res.headers["set-cookie"]`, `err.config.headers.authorization`, `*.authorization`, `*.Authorization`, `*.headers.authorization`, `*.*.headers.authorization`, `*.accessToken`, `*.access_token`, `*.refreshToken`, `*.refresh_token`, `*.token`, `*.apiKey`, `*.api_key`, `*.secret`, `*.client_secret`, `*.clientSecret`, `*.appSecret`, `*.privateKey`, `*.password`, `*.serviceRoleKey`, `*.ciphertext`. pino wildcards match one level only, so never log raw provider objects — sanitize first. Provider error bodies logged truncated to 500 chars after redaction. Audit metadata built from allow-listed fields only.

## 6. Audit log

`AuditService.record({ projectId, actorUserId, action, entityType, entityId, metadata, requestId })` called from services (not controllers). Actions: `project.updated`, `member.added|role_changed|removed`, `integration.updated|verified|disconnected|refresh_failed`, `query.created|updated|enabled|disabled|deleted|restored|run_requested|backfill_requested`, `analysis.reanalyze_requested|bulk_reanalyze_requested|retry_requested`, `override.created|revoked`, `mentions.exported`, `analysis_settings.updated`, `data.purged` (purge CLI T-126, scheduled retention job T-153). Immutable (no update/delete endpoints). Retention ≥ 12 months.

Implementation (`apps/api/src/modules/audit/`, T-059):

- `record(input, tx?)` — pass a Prisma `tx` to write the audit row in the same transaction as the mutation (audit failure then fails the mutation). Without `tx`, a failed write is logged at `warn` (no metadata) and never blocks the caller. `id` is a uuid v7; `requestId` comes from `req.id`.
- Metadata sanitizing (`sanitizeAuditMetadata`): top-level keys must be in a shared allow-list (`changes, before, after, fields, role, previousRole, queryValue, queryType, since, until, jobId, runId, effectiveVersion, count, postIds, filters, format, rowCount, field, value, reason, status, errorCode, name, email, enabled`); keys matching `/token|secret|password|api[_-]?key|authorization|ciphertext|private|service[_-]?role|credential|cookie|^key$/i` are dropped at any depth, even when allow-listed. Max depth 3, strings ≤ 500 chars, serialized JSON ≤ 4 KB (otherwise stored as `{ truncated: true }`). Per-action allow-lists are post-MVP.

## 7. Transport & app hardening

- HTTPS everywhere (host-terminated). HSTS at host.
- `helmet()` defaults; `CORS_ORIGINS` allow-list (exact origins); credentials not needed.
- Body limit 1 MB; query array limits (≤ 50 values).
- Throttling (`@nestjs/throttler`): global 300 req/min/user; `run` 10/min/project; bulk re-analysis 1/5 min/project; export 5/min/user; verify 5/min/project.
- Zod validation on all inputs; enums strict; `q` max 200 chars; UUID params validated.
- Output: post text delivered as JSON string; FE renders text nodes only; links rendered with `rel="noopener noreferrer"`.
- Swagger disabled in production by default.

## 8. Data protection & compliance

- Store only requested provider fields; no enrichment; no media binaries; `raw_data` truncated.
- Purge tooling: `pnpm --filter @how-about-me/api purge -- --post <id> | --project <id> --before <date> | --sync-jobs --before <date>` (dry run by default, audited as `data.purged`). See [../05-operations/04-data-retention-purge.md](../05-operations/04-data-retention-purge.md).
- Access limited to invited internal roles; audit for all mutations.
- Before production: review Meta Platform Terms for retention; record policy version used for automated safety labels.

## 9. CI security gates

- `scripts/check-fe-secrets.mjs` (`pnpm check:fe-secrets --build-env` in the CI `build` job, logic in `scripts/lib/fe-secrets.mjs`):
  - **Env check.** With `--build-env`, fails if any server-only var is set in the web build env: `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `THREADS_APP_SECRET`, `THREADS_ACCESS_TOKEN`, `INTEGRATION_ENCRYPTION_KEYS`, `DATABASE_URL`, `DIRECT_URL`. Always fails on a `NEXT_PUBLIC_*` var whose name contains `SERVICE_ROLE|SECRET|OPENAI|TOKEN|PRIVATE|DATABASE`, whose value looks like an OpenAI key (`sk-…`), or whose value is a JWT with `role: service_role`.
  - **Bundle check.** Scans `apps/web/.next` (excluding cache) for the patterns `SUPABASE_SERVICE_ROLE_KEY`, `service_role`, `sk-…`, `OPENAI_API_KEY`, `THREADS_APP_SECRET`, `THREADS_ACCESS_TOKEN`, `INTEGRATION_ENCRYPTION_KEYS`, `DATABASE_URL`, and for the literal value (≥ 8 chars) of every server-only var present in the env.
- `pnpm audit:check` (`scripts/audit-check.mjs`): runs `pnpm audit --prod --json` and fails on any high/critical advisory not in `.audit-allowlist.json`, or whose entry has expired. Stale entries only warn.
  - Entry format: `"GHSA-xxxx": { "package": "…", "reason": "…", "expires": "YYYY-MM-DD" }`. Expiry ≤ 90 days; the reviewer of the PR adding the entry approves it. Prefer fixing (upgrade / `pnpm.overrides`) over allowlisting.
  - At T-003 all existing high/critical advisories were allowlisted until 2026-11-14. #149 (2026-10-13) fixed them by upgrading `next` to 16.3.8 and adding `pnpm.overrides` (see `07-ci-cd.md` §1.3). Only `braces` GHSA-vfj7-8cjw-p6xm remains allowlisted (no upstream patch, ESLint tooling only), expiring 2027-01-11.
- Secret scanning: `gitleaks` action on PRs (full history, `fetch-depth: 0`) and in the `pre-push` hook. A false positive (e.g. a test fixture) goes into `.gitleaksignore` by fingerprint with a comment; a real secret is rotated, never ignored.
- Dependabot weekly for npm + GitHub Actions.

## 10. Security checklist (release gate, mirrors source §8)

- [ ] Service-role key absent from web build & env
- [ ] Threads token & OpenAI key absent from web
- [ ] Redaction verified in logs (test emits a fake token → not present)
- [ ] RBAC matrix tests green
- [ ] Admin mutations audited (spot check)
- [ ] Input validation on all filters/bodies
- [ ] Throttling on run/bulk/export/verify
- [ ] Content rendered as text; external links safe
- [ ] Production CORS restricted
- [ ] Separate staging/prod secrets
- [ ] Backups verified (restore drill on staging)
- [ ] Purge workflow tested on staging
