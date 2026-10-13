# CLI scripts (run with `pnpm --filter @how-about-me/api <script>`)

- `poc:threads` — T-021 Threads POC runner
- `eval:classifier` — T-079 classifier + safety evaluation report. `-- --dataset <jsonl> [--out <md>] [--json <path>] [--brand-context <text>] [--limit N] [--concurrency N] [--fail-on-gate]`. See docs/04-qa/03-ai-evaluation-plan.md §3
- `purge` — T-126 retention/purge. Dry run by default; `-- --post <platform_post_id> | --project <uuid> --before YYYY-MM-DD | --sync-jobs --before YYYY-MM-DD [--project <uuid>] | --runs --before YYYY-MM-DD [--project <uuid>]` plus `--apply`, `--batch-size`, `--actor`. See docs/05-operations/04-data-retention-purge.md §2
- `secrets:rewrap` — T-037 encryption key rotation
- `perf:seed` — T-097 deterministic synthetic 100k-post dataset into `PERF_DATABASE_URL` (refuses db names without `perf`/`test` or non-local hosts unless `--allow-any-db`). `-- [--posts N] [--seed N] [--days N] [--anchor <ISO>] [--chunk N] [--truncate]`
- `perf:explain` — T-097 p50/p95 + `EXPLAIN (ANALYZE, BUFFERS)` of every analytics/mentions/export query on the perf DB. `-- [--runs N] [--warmup N] [--only <text>] [--out <md>] [--json <path>] [--prepared-cache]`. See docs/02-architecture/12-performance-report.md
