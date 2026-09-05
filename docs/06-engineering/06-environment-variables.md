# 06 · Environment Variables

Source of truth: `apps/api/.env.example`, `apps/web/.env.example`. Validated at boot (Zod). **Never commit real values.** Items marked _(owner input)_ are provided by the Product Owner.

## apps/api

| Variable                                                       | Required   | Default                               | Description                                                                                          |
| -------------------------------------------------------------- | ---------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                                     | yes        | `development`                         |                                                                                                      |
| `APP_ROLE`                                                     | yes        | `all`                                 | `api` \| `worker` \| `all`                                                                           |
| `PORT`                                                         | no         | `4000`                                |                                                                                                      |
| `LOG_LEVEL`                                                    | no         | `info`                                |                                                                                                      |
| `CORS_ORIGINS`                                                 | prod       | `http://localhost:3000`               | comma list                                                                                           |
| `DATABASE_URL`                                                 | yes        | —                                     | pooled (Supabase: port 6543, `?pgbouncer=true&connection_limit=10`) _(owner input for staging/prod)_ |
| `DIRECT_URL`                                                   | yes        | —                                     | direct connection for migrations                                                                     |
| `SUPABASE_URL`                                                 | yes        | —                                     | `https://<ref>.supabase.co`                                                                          |
| `SUPABASE_JWT_SECRET`                                          | one of     | —                                     | HS256 verification (legacy projects)                                                                 |
| `SUPABASE_JWKS_URL`                                            | one of     | derived                               | JWKS verification (default `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`)                          |
| `SUPABASE_SERVICE_ROLE_KEY`                                    | no         | —                                     | server-only; invites & `seed:auth-user` _(owner input)_                                              |
| `SEED_ADMIN_EMAIL`                                             | seed       | —                                     | first admin                                                                                          |
| `INTEGRATION_ENCRYPTION_KEYS`                                  | yes        | —                                     | JSON `{"k1":"<base64 32 bytes>"}` (`openssl rand -base64 32`)                                        |
| `INTEGRATION_ENCRYPTION_ACTIVE_KEY`                            | yes        | `k1`                                  |                                                                                                      |
| `THREADS_API_BASE_URL`                                         | no         | `https://graph.threads.net/v1.0`      | verify in POC                                                                                        |
| `THREADS_REQUEST_TIMEOUT_MS`                                   | no         | `15000`                               |                                                                                                      |
| `THREADS_APP_ID` / `THREADS_APP_SECRET`                        | if OAuth   | —                                     | _(owner input)_                                                                                      |
| `PROVIDERS_MODE`                                               | no         | `fake` (dev) / `real` (staging, prod) | fake providers for local/e2e                                                                         |
| `COLLECTOR_*`                                                  | no         | see doc 06 §10                        | tick, concurrency, pages, retries, lock, window, circuit                                             |
| `ANALYSIS_*`                                                   | no         | see doc 07 §11                        | poll, batch, concurrency, attempts, two-step, budget, bulk max                                       |
| `ANALYSIS_CLASSIFIER_PROVIDER`                                 | yes (real) | `openai`                              |                                                                                                      |
| `ANALYSIS_CLASSIFIER_MODEL`                                    | yes (real) | —                                     | _(owner input)_                                                                                      |
| `ANALYSIS_PRICE_INPUT_PER_1M` / `ANALYSIS_PRICE_OUTPUT_PER_1M` | no         | `0`                                   | USD per 1M tokens for cost estimates                                                                 |
| `ANALYSIS_BRAND_CONTEXT`                                       | no         | seeded                                | brand description for the prompt                                                                     |
| `SAFETY_PROVIDER` / `SAFETY_MODEL`                             | no         | `openai` / `omni-moderation-latest`   |                                                                                                      |
| `OPENAI_API_KEY`                                               | yes (real) | —                                     | _(owner input)_                                                                                      |
| `EXPORT_MAX_ROWS`                                              | no         | `10000`                               | P1                                                                                                   |
| `METRICS_TOKEN`                                                | no         | —                                     | protects `/metrics`                                                                                  |
| `SWAGGER_ENABLED`                                              | no         | `true` (dev)                          |                                                                                                      |
| `RETENTION_*_DAYS`                                             | no         | see retention doc                     |                                                                                                      |

## apps/web

| Variable                        | Required | Description                          |
| ------------------------------- | -------- | ------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | yes      | _(owner input)_                      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes      | public anon key _(owner input)_      |
| `NEXT_PUBLIC_API_BASE_URL`      | yes      | e.g. `http://localhost:4000/api/v1`  |
| `NEXT_PUBLIC_DEFAULT_TIMEZONE`  | no       | `Asia/Ho_Chi_Minh`                   |
| `NEXT_PUBLIC_APP_ENV`           | no       | `local` \| `staging` \| `production` |

Forbidden in web: anything without `NEXT_PUBLIC_`, and never service-role/OpenAI/Threads values (CI check).

## Where secrets live per environment

local → `.env` files (git-ignored) · staging/prod → host secret store (Vercel env, API host env). Rotation procedures: [../05-operations/02-runbook.md §6](../05-operations/02-runbook.md#6-tokensecret-rotation).
