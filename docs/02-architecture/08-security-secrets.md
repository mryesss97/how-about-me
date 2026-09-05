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

- Supabase issues access tokens (JWT, 1 h) + refresh tokens. API verifies with Supabase JWKS (`SUPABASE_URL/auth/v1/.well-known/jwks.json`, cached 10 min) or `SUPABASE_JWT_SECRET` (HS256 projects). Verify `iss`, `aud=authenticated`, `exp`.
- `sub` → `user_profiles.id`. Email from claims; profile upsert on first call.
- Sign-ups disabled in Supabase dashboard; invitations by Admin (`POST /members`) → optional Supabase invite email via service-role key **server-side only** (`SUPABASE_SERVICE_ROLE_KEY` in API env, never web).
- No cookies for API auth (Bearer only) → CSRF not applicable to API; the Next.js server uses Supabase cookies solely for redirecting unauthenticated users; state-changing calls go browser → API with Bearer.

## 3. Authorization (RBAC)

- `ProjectRoleGuard` + `@Roles('admin')` etc. per [../01-product/02-personas-rbac.md](../01-product/02-personas-rbac.md).
- Project settings gates (`allowAnalystReanalyze`, `allowViewerExport`) evaluated in the guard for the specific endpoints.
- Deny by default: controllers without `@Roles` under `/projects/:projectId` require membership; controllers outside (`/me`) require a valid JWT.
- Tests: role matrix table-driven tests for every mutating route (TC-AUTH).

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

pino `redact` paths: `req.headers.authorization`, `*.accessToken`, `*.access_token`, `*.token`, `*.apiKey`, `*.api_key`, `*.secret`, `*.password`, `*.serviceRoleKey`. Provider error bodies logged truncated to 500 chars after redaction. Audit metadata built from allow-listed fields only.

## 6. Audit log

`AuditService.record({ projectId, actorUserId, action, entityType, entityId, metadata, requestId })` called from services (not controllers). Actions: `project.updated`, `member.added|role_changed|removed`, `integration.updated|verified|disconnected|refresh_failed`, `query.created|updated|enabled|disabled|deleted|restored|run_requested|backfill_requested`, `analysis.reanalyze_requested|bulk_reanalyze_requested|retry_requested`, `override.created|revoked`, `mentions.exported`, `analysis_settings.updated`. Immutable (no update/delete endpoints). Retention ≥ 12 months.

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
- Purge tooling: `pnpm --filter api purge -- --post <id> | --project <id> --before <date>` (audited). See [../05-operations/04-data-retention-purge.md](../05-operations/04-data-retention-purge.md).
- Access limited to invited internal roles; audit for all mutations.
- Before production: review Meta Platform Terms for retention; record policy version used for automated safety labels.

## 9. CI security gates

- `scripts/check-fe-secrets.mjs`: scans `apps/web/.next` output for forbidden patterns (`SERVICE_ROLE`, `sk-`, `THREADS_ACCESS`, `OPENAI_API_KEY`).
- `pnpm audit --prod --audit-level=high` (allow-list file `.audit-allowlist.json` with justification & expiry).
- Secret scanning: `gitleaks` action on PRs.
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
