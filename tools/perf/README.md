# Performance tests (k6) — T-120

Load tests for NFR-001…004 (and NFR-007) at 20 virtual users against a real API (staging, or a local production build as proxy). Results go to [docs/02-architecture/12-performance-report.md](../../docs/02-architecture/12-performance-report.md) §7. Not part of `verify`/CI — needs a seeded environment and a perf user.

## Prerequisites

- [k6](https://k6.io) ≥ 0.50 (`brew install k6`). Not an npm dependency; scripts run in the k6 runtime.
- A database seeded with `pnpm --filter @how-about-me/api perf:seed` (100 k posts, project `perf-large`). For a non-local DB: `perf:seed --database-url <url> --allow-any-db` — only on a dedicated perf database, never one with real data. The seed anchors its 7-day burst at seed time: seed right before the run.
- A Supabase user that is a member (viewer is enough) of `perf-large`.
- The global throttler (`app.module.ts`, 300 req/min per client) rejects 20 VU from one IP with 429. Run against an API where the throttler is relaxed for the run, and record that in the report.

## Environment

| Variable                                                                               | Required | Meaning                                                                                                    |
| -------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| `PERF_BASE_URL`                                                                        | yes      | API origin, e.g. `https://api.staging.example` (without `/api/v1`)                                         |
| `PERF_PROJECT_ID`                                                                      | yes      | id of `perf-large`                                                                                         |
| `PERF_TOKEN`                                                                           | one of   | Supabase access token (expires after ~1 h — keep runs short)                                               |
| `PERF_SUPABASE_URL`, `PERF_SUPABASE_ANON_KEY`, `PERF_USER_EMAIL`, `PERF_USER_PASSWORD` | one of   | password grant in `setup()` instead of `PERF_TOKEN`                                                        |
| `PERF_TZ`                                                                              | no       | default `Asia/Ho_Chi_Minh`                                                                                 |
| `PERF_VUS` / `PERF_DURATION` / `PERF_WARMUP`                                           | no       | default `20` / `5m` / `30s` (warm-up not thresholded)                                                      |
| `PERF_THINK_S`                                                                         | no       | mean think time per iteration in seconds, ±50 % jitter (default `3`); without it one VU fires ~1,500 req/s |
| `PERF_Q_TERMS`                                                                         | no       | comma list of `q` terms for NFR-007                                                                        |
| `PERF_SUMMARY_JSON`                                                                    | no       | path to write the full k6 summary JSON (contains no headers/tokens)                                        |

Pass secrets only through the shell environment; never commit them or paste them into the report.

## Scripts

| Script        | Target                                                                                  | Threshold (measure phase)        |
| ------------- | --------------------------------------------------------------------------------------- | -------------------------------- |
| `overview.js` | NFR-001: overview 24h/7d + dashboard burst (timeseries + 6 distributions, `http.batch`) | overview p95 < 1500 ms           |
| `mentions.js` | NFR-002 list `limit=25`, mixed sort/range/`count`/filters; NFR-007 `q`                  | p95 < 1000 ms; `q` p95 < 1500 ms |
| `detail.js`   | NFR-003: detail over ~200 ids from the list                                             | p95 < 700 ms                     |
| `all.js`      | mixed run, `PERF_VUS` total (40 % overview, 40 % list, 20 % detail)                     | all of the above                 |

All scripts fail (exit ≠ 0) on a breached threshold, `http_req_failed` ≥ 1 % or checks < 99 %.

```bash
# Smoke locally first (API on :4000, local perf:seed, local user token)
PERF_BASE_URL=http://localhost:4000 PERF_PROJECT_ID=<id> PERF_TOKEN=<token> \
  k6 run -e PERF_VUS=1 -e PERF_WARMUP=1s -e PERF_DURATION=10s tools/perf/overview.js

# Acceptance: 20 VU per endpoint, then 20 VU mixed
k6 run tools/perf/overview.js && k6 run tools/perf/mentions.js && k6 run tools/perf/detail.js
pnpm perf:k6   # = k6 run tools/perf/all.js
```

Read the per-endpoint p50/p95/p99 table printed at the end; run each 3 times and report the median.

## Lighthouse (NFR-004)

1. Log in to the web app as the perf user in Chrome; copy the Supabase auth cookie(s).
2. For each page (overview, mentions explorer, mention detail), run 5 times with a warm cache:

```bash
npx lighthouse@12 "<web>/projects/<id>/overview" --preset=desktop \
  --extra-headers='{"Cookie":"<cookie>"}' --only-categories=performance \
  --output=json --output-path=<scratch>/lh-overview-1.json
```

3. Report the median Time to Interactive and LCP. `lighthouse` is used via `npx` on purpose, not added to the workspace.

## Throttling

The API allows `THROTTLE_GLOBAL_LIMIT` requests per minute per client (default 300, NFR-017). 20 VU from one k6 machine exceed it, so start the API under test with a higher value for the run (e.g. `THROTTLE_GLOBAL_LIMIT=100000`) and put it back afterwards. Local baseline and findings: `docs/02-architecture/12-performance-report.md` §7.0.
