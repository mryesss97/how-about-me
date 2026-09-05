# 02 · Personas, Roles & Permission Matrix

| Field   | Value                                                                                                                                                                        |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status  | Approved                                                                                                                                                                     |
| Source  | [00-source/01_PRODUCT_REQUIREMENTS.md](../00-source/01_PRODUCT_REQUIREMENTS.md) §4 · [00-source/02_TECHNICAL_ARCHITECTURE.md](../00-source/02_TECHNICAL_ARCHITECTURE.md) §13 |
| Related | [04-functional-requirements.md](04-functional-requirements.md) FR-010…FR-029 · [../02-architecture/08-security-secrets.md](../02-architecture/08-security-secrets.md)        |

## 1. Personas

### P1 — Linh, Brand/Marketing Analyst (role: **Analyst**)

- Checks the Overview every morning; compares this week vs last week.
- Digs into negative spikes, reads original posts, tags misclassifications.
- Needs: fast filters, drill-down, export to build a weekly deck, confidence indicators.
- Pain today: manual Threads search, no history, no denominators.

### P2 — Minh, Operations / Growth Lead (role: **Admin**)

- Owns Meta app credentials and listening terms; adds terms around campaigns/events.
- Needs: add a keyword in 30 seconds, see whether sync is healthy, trigger backfill/re-analysis.
- Pain today: doesn't know when data is missing vs when nothing happened.

### P3 — Hà, Customer Service Supervisor (role: **Viewer**)

- Wants complaint / support-request volume and examples; read-only.
- Needs: simple dashboard, clear badges, links to Threads.

### P4 — Engineer on call (role: **Admin**, technical)

- Uses System Status, sync job detail, logs; rotates tokens.

## 2. Roles

| Role      | Summary                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------ |
| `admin`   | Full control of the project: integration, queries, sync, analysis, users/roles, export           |
| `analyst` | Read everything, review/override analysis (P1), export, re-analyze a single mention (if enabled) |
| `viewer`  | Read-only dashboards & mentions; export only if enabled by Admin                                 |

Roles are **per project** (`project_members.role`). MVP has one project; the model supports many.

## 3. Permission matrix (server-enforced)

Legend: ✅ allowed · ❌ denied · ⚙️ allowed when project setting enables it · P1 = shipped in P1 scope

| Capability                                            | Endpoint(s)                                                   | Admin | Analyst                    | Viewer                 |
| ----------------------------------------------------- | ------------------------------------------------------------- | ----- | -------------------------- | ---------------------- |
| Sign in / view own profile                            | `GET /me`                                                     | ✅    | ✅                         | ✅                     |
| List/view projects I belong to                        | `GET /projects`, `GET /projects/:id`                          | ✅    | ✅                         | ✅                     |
| Edit project name/timezone                            | `PATCH /projects/:id`                                         | ✅    | ❌                         | ❌                     |
| Manage members & roles                                | `GET/POST/PATCH/DELETE /projects/:id/members`                 | ✅    | ❌                         | ❌                     |
| View Threads integration status                       | `GET /projects/:id/integrations/threads`                      | ✅    | ✅ (no secrets)            | ✅ (no secrets)        |
| Configure Threads integration / rotate token          | `PUT /projects/:id/integrations/threads`, `POST …/verify`     | ✅    | ❌                         | ❌                     |
| List/view listening queries                           | `GET …/listening-queries`                                     | ✅    | ✅                         | ✅                     |
| Create/edit/enable/disable/soft-delete/restore query  | `POST/PATCH/DELETE …/listening-queries/:id`, `POST …/restore` | ✅    | ❌                         | ❌                     |
| Run query now                                         | `POST …/listening-queries/:id/run`                            | ✅    | ❌                         | ❌                     |
| Backfill (P1)                                         | `POST …/listening-queries/:id/backfill`                       | ✅    | ❌                         | ❌                     |
| View dashboard analytics                              | `GET …/analytics/*`                                           | ✅    | ✅                         | ✅                     |
| View mentions & detail                                | `GET …/mentions`, `GET …/mentions/:id`                        | ✅    | ✅                         | ✅                     |
| Re-analyze a single mention                           | `POST …/mentions/:id/reanalyze`                               | ✅    | ⚙️ `allowAnalystReanalyze` | ❌                     |
| Bulk re-analyze (P1)                                  | `POST …/mentions/reanalyze`                                   | ✅    | ❌                         | ❌                     |
| Add / revoke analyst override (P1)                    | `POST/DELETE …/mentions/:id/overrides`                        | ✅    | ✅                         | ❌                     |
| Export CSV (P1)                                       | `GET …/mentions/export.csv`                                   | ✅    | ✅                         | ⚙️ `allowViewerExport` |
| View sync jobs                                        | `GET …/sync-jobs`                                             | ✅    | ✅                         | ✅                     |
| View system status                                    | `GET …/system-status`                                         | ✅    | ✅                         | ✅                     |
| View audit log                                        | `GET …/audit-logs`                                            | ✅    | ❌                         | ❌                     |
| Change classification thresholds / policy config (P1) | `PATCH …/settings/analysis`                                   | ✅    | ❌                         | ❌                     |

Project settings introduced by this matrix (stored on `monitoring_projects.settings jsonb`, defaults in brackets):

- `allowAnalystReanalyze` [true]
- `allowViewerExport` [false]

## 4. Enforcement rules

1. Every request carries `Authorization: Bearer <Supabase JWT>`; NestJS verifies signature & expiry (see [../02-architecture/08-security-secrets.md](../02-architecture/08-security-secrets.md)).
2. `ProjectRoleGuard` resolves `(userId, projectId) → role` from `project_members` and checks against the endpoint's `@Roles(...)` decorator. No membership → `403 FORBIDDEN_PROJECT`.
3. Read endpoints require membership of any role; write endpoints require the role listed above.
4. FE uses `/me` to hide controls, **only** as UX. Tests assert the BE denies regardless.
5. All Admin mutations write an `audit_logs` row (see [../02-architecture/08-security-secrets.md#audit](../02-architecture/08-security-secrets.md#6-audit-log)).

## 5. Authentication

- Supabase Auth, email + password (magic link acceptable), optional Google provider (org decision).
- Accounts are invite-only in MVP: Admin adds a member by email; sign-up disabled in Supabase settings; a `user_profiles` row is created on first login (BE upsert from JWT claims).
- Session refresh handled by Supabase client in FE; API rejects expired tokens with `401 AUTH_TOKEN_EXPIRED`.
- Bootstrapping: the first Admin is seeded by migration/seed using an environment-provided email (`SEED_ADMIN_EMAIL`).

## 6. User stories touching this doc

US-001…US-012 in [03-user-stories.md](03-user-stories.md#e01-authentication--rbac).
