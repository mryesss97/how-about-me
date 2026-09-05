# 09 · Observability

| Field        | Value                                                                                                                                                                                     |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status       | Approved (baseline v1.0)                                                                                                                                                                  |
| Source       | [00-source/02_TECHNICAL_ARCHITECTURE.md](../00-source/02_TECHNICAL_ARCHITECTURE.md) §15, §23 · [00-source/04_OPERATIONS_COSTS_ROADMAP.md](../00-source/04_OPERATIONS_COSTS_ROADMAP.md) §9 |
| Requirements | FR-170…FR-176, NFR-050…NFR-053                                                                                                                                                            |

## 1. Logging

- `nestjs-pino`, JSON in staging/prod, pretty in local. Level `info` default; `debug` via `LOG_LEVEL`.
- Standard fields: `time, level, msg, request_id, user_id, project_id, job_id, run_id, query_id, provider, status, duration_ms, result_count, error_code, app_role, version (git sha)`.
- One log line per: HTTP request (interceptor), provider request (adapter), job start/finish, run finish, scheduler tick summary, circuit open/close, integration status change.
- Never log tokens/keys (redaction list in [08-security-secrets.md](08-security-secrets.md#5-redaction--logging)); post text logged only at `debug` and truncated to 120 chars.

## 2. Metrics (Prometheus text at `GET /metrics`, protected by `METRICS_TOKEN` header; or periodic `metrics` log line when scraping is unavailable)

| Metric                                   | Type        | Labels                                                                    |
| ---------------------------------------- | ----------- | ------------------------------------------------------------------------- |
| `collector_sync_jobs_total`              | counter     | `status`, `trigger`                                                       |
| `collector_provider_requests_total`      | counter     | `provider`, `outcome` (`ok`,`rate_limited`,`error`,`timeout`)             |
| `collector_provider_request_duration_ms` | histogram   | `provider`                                                                |
| `collector_records_total`                | counter     | `kind` (`fetched`,`inserted`,`updated`,`duplicated`,`invalid`,`excluded`) |
| `collector_rate_limit_events_total`      | counter     | `provider`                                                                |
| `collector_collection_lag_seconds`       | gauge       | `project`                                                                 |
| `collector_circuit_open`                 | gauge (0/1) | `project`                                                                 |
| `analysis_runs_total`                    | counter     | `status`, `trigger`                                                       |
| `analysis_queue_depth`                   | gauge       | `status` (`pending`,`processing`)                                         |
| `analysis_run_duration_ms`               | histogram   | `step` (`relevance`,`safety`,`classify`,`total`)                          |
| `analysis_provider_calls_total`          | counter     | `provider`, `outcome`                                                     |
| `analysis_tokens_total`                  | counter     | `direction`                                                               |
| `analysis_estimated_cost_usd_total`      | counter     | `provider`                                                                |
| `analysis_lag_seconds`                   | gauge       | `project`                                                                 |
| `http_requests_total`                    | counter     | `route`, `method`, `status`                                               |
| `http_request_duration_ms`               | histogram   | `route`                                                                   |
| `db_pool_connections`                    | gauge       | `state`                                                                   |

Business gauges derived on demand by System Status (not exported as metrics): approximate posts/analyses counts.

## 3. Health

- `GET /health/live` — process up.
- `GET /health/ready` — `database: SELECT 1` (required), `threads` (integration status ≠ error → up; informational), `classifier` (last provider call within 1 h ok → up; informational). Only DB failure returns 503.

## 4. System Status semantics (FR-176)

| Field                  | Rule                                                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `collector.status`     | `paused` if circuit open or integration ≠ connected; `degraded` if `successRate24h < 0.8` or `collectionLagSeconds > 3 × max(poll_interval)`; else `healthy` |
| `analysis.status`      | `budget_paused` / `degraded` (failure rate 24 h > 10 % or lag > 30 min) / `healthy`                                                                          |
| `collectionLagSeconds` | `now − max(last_successful_sync_at)` over enabled queries                                                                                                    |
| `analysisLagSeconds`   | `now − min(created_at)` of pending/processing runs, else 0                                                                                                   |

## 5. Dashboards & alerts (staging/prod, host-provided or Grafana Cloud free)

Panels: sync success rate, provider latency p95, inserted vs duplicates, rate-limit events, queue depth, analysis failures, AI cost/day, API p95 by route, DB connections/storage.

| Alert               | Condition                                          | Severity |
| ------------------- | -------------------------------------------------- | -------- |
| Ingestion stalled   | `collection_lag_seconds > 3600` for 15 min         | high     |
| Integration expired | `integration status ∈ {expired, permission_error}` | high     |
| Circuit open        | `collector_circuit_open == 1` for 10 min           | medium   |
| Analysis backlog    | `analysis_queue_depth{pending} > 500` for 30 min   | medium   |
| Analysis failures   | failure rate 24 h > 10 %                           | medium   |
| AI budget           | `estimated cost today > ANALYSIS_DAILY_BUDGET_USD` | medium   |
| API errors          | 5xx rate > 2 % for 10 min                          | high     |
| DB storage          | > 80 % of plan disk                                | medium   |

Alert delivery for MVP: email to on-call; Slack webhook is P2 product feature but ops alerts can use host integrations immediately.

## 6. Tracing

Not required for MVP; `request_id` propagates to provider calls via headers where supported and into job/run rows (`request_id` column on audit; `requested_by` on jobs). OpenTelemetry can be added later without code changes to business modules.

## 7. Launch checklist (mirrors source §9)

- [ ] Collector success rate visible · [ ] last successful sync visible · [ ] per-query last success/error · [ ] analysis queue size · [ ] analysis failure count · [ ] API p95 · [ ] DB usage · [ ] rate-limit events · [ ] token expiry/connection state · [ ] request ids in logs · [ ] job ids in logs
