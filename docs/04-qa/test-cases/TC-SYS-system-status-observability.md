# TC-SYS · System Status, Health, Audit (E09)

Refs: FR-170…FR-176, FR-200…FR-201

| ID         | Title                          | Pre                             | Steps                                           | Expected                                                                         | Refs   | Pri | Type |
| ---------- | ------------------------------ | ------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------- | ------ | --- | ---- |
| TC-SYS-001 | Status page sections           | —                               | open `/system-status`                           | Threads / Collector / Analyzer / Database cards; auto-refresh 30 s indicator     | FR-170 | P0  | M    |
| TC-SYS-002 | Status API shape               | —                               | GET                                             | matches contract; no secrets                                                     | FR-171 | P0  | A    |
| TC-SYS-003 | Collector status rules         | inject lag / failures / circuit | GET                                             | healthy/degraded/paused per doc 09 §4                                            | FR-176 | P0  | A    |
| TC-SYS-004 | Analyzer status rules          | failures/lag/budget             | GET                                             | healthy/degraded/budget_paused                                                   | FR-176 | P0  | A    |
| TC-SYS-005 | Lags computed                  | fixtures                        | GET                                             | collection/analysis lag per definitions                                          | FR-176 | P0  | A    |
| TC-SYS-006 | Health live                    | —                               | GET `/health/live`                              | 200 `ok` without auth                                                            | FR-172 | P0  | A    |
| TC-SYS-007 | Health ready DB down           | stop DB                         | GET ready                                       | 503 `database: down`                                                             | FR-172 | P0  | A    |
| TC-SYS-008 | Ready with provider degraded   | fake provider down              | GET ready                                       | 200 `degraded`; dashboard still works                                            | FR-172 | P0  | A    |
| TC-SYS-009 | Structured logs                | run a job                       | inspect logs                                    | JSON with request_id/job_id/query_id/project_id/duration_ms/error_code; no token | FR-173 | P0  | A+M  |
| TC-SYS-010 | Metrics endpoint               | `METRICS_TOKEN`                 | GET `/metrics`                                  | Prometheus text with listed metrics; 401 without token                           | FR-174 | P0  | A    |
| TC-SYS-011 | Retry failed sync job          | failed job                      | click Retry (admin)                             | new job resumes from cursor; viewer has no button & API 403                      | FR-175 | P0  | A+M  |
| TC-SYS-012 | Retry failed analysis          | failed run                      | Retry / Retry all (≤500)                        | runs pending; audit                                                              | FR-175 | P0  | A+M  |
| TC-SYS-013 | Sync jobs tab filters          | jobs                            | filter by query/status/date; open detail drawer | correct; counters & error shown                                                  | FR-081 | P0  | M    |
| TC-SYS-014 | Audit rows for admin mutations | perform each mutation           | list audit                                      | rows with actor/action/entity; no secrets                                        | FR-200 | P0  | A+M  |
| TC-SYS-015 | Audit viewer admin only        | analyst                         | open tab / GET                                  | hidden; `403`                                                                    | FR-201 | P0  | A+M  |
| TC-SYS-016 | Database card                  | —                               | view                                            | approx posts/analyses; last migration                                            | FR-170 | P1  | M    |
