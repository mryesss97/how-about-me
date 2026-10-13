# 02 · Analytics QA / Reconciliation Checklist

Run on staging with the seeded fixture dataset **and** on a real-data sample range. Record results in the QC issue with build sha.

Definitions: [../01-product/07-metric-definitions.md](../01-product/07-metric-definitions.md).

| #   | Check                                         | How                                                                                                         | Pass criterion                                                             |
| --- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| A1  | Total = distinct relevant posts               | `overview.kpis.mentionCount` vs `SELECT COUNT(DISTINCT id) …` (or `/mentions?count=true` with same filters) | equal                                                                      |
| A2  | Multi-query post counted once project-wide    | fixture post matched by `1zone` and `eventista`                                                             | counted once in total; once per query in query-share (P1)                  |
| A3  | Sentiment sum                                 | positive + neutral + negative = `sentiment.denominator`                                                     | equal                                                                      |
| A4  | Safety denominator excludes pending           | pending posts in range                                                                                      | not in `safety.denominator`                                                |
| A5  | Intent shares may exceed 100 %                | fixture with multi-intent                                                                                   | UI does not normalise; tooltip explains                                    |
| A6  | Topic shares may exceed 100 %                 | same                                                                                                        | same                                                                       |
| A7  | Previous period boundary in tz                | range 7 d ending today 00:00 `Asia/Ho_Chi_Minh`                                                             | `range.previous` = exactly the 7 d before in +07:00                        |
| A8  | Irrelevant excluded by default                | fixture irrelevant posts                                                                                    | not in any KPI/chart; visible when `relevance=irrelevant`                  |
| A9  | Overrides affect effective analytics (P1)     | override a negative → neutral                                                                               | negativeRate decreases by exactly 1 numerator                              |
| A10 | Re-analysis does not duplicate                | re-analyze a post                                                                                           | totals unchanged; runs +1                                                  |
| A11 | Growth `New` when previous = 0                | range with empty previous                                                                                   | `growthPct=null, growthState="new"`; UI shows "New"                        |
| A12 | Rate `—` when denominator 0                   | range with no analysed                                                                                      | `null`; UI shows "—" not 0 %                                               |
| A13 | Drill-down equivalence — each KPI             | click each KPI                                                                                              | mentions `totalCount` = KPI numerator                                      |
| A14 | Drill-down equivalence — each chart segment   | click 3 segments per chart                                                                                  | `totalCount` = segment count                                               |
| A15 | Timeseries zero-fill & sum                    | sum of buckets                                                                                              | = mentionCount; empty buckets present as 0                                 |
| A16 | Hour vs day bucketing                         | 24 h → hour; 7 d → day                                                                                      | correct `interval`                                                         |
| A17 | Coverage arithmetic                           | analyzed + pending + failed                                                                                 | = relevant + (pending/failed unknown relevance) per definition; documented |
| A18 | Exclude-terms post not counted for that query | fixture "time zone"                                                                                         | excluded from `1zone` counts, still visible with `includeExcluded` (ops)   |
| A19 | Compare series alignment                      | timeseries with compare                                                                                     | previous bucket i aligns to current bucket i                               |
| A20 | Metrics version exposed                       | `overview.meta.metricsVersion`                                                                              | `metrics-v1`                                                               |

## Automated coverage (T-094)

Spec: `apps/api/test/integration/analytics/fixture-equivalence.int-spec.ts` (API side; UI rendering stays manual).

- Automated there: A1, A2, A3, A4, A8, A9, A13, A14 (every returned segment, not only 3), A15, A18 (counting side), A20; A5/A6 API side (Σ intents > denominator).
- Elsewhere: A7, A11, A12 → `analytics-overview.int-spec.ts`; A16, A19 → `analytics-timeseries.int-spec.ts`; A10 → `mentions-reanalyze.int-spec.ts`.
- Manual: A5/A6 UI tooltip, A17 sign-off. A18 "still visible with `includeExcluded`": `/mentions` has no such parameter yet (`MentionsListQuerySchema`), so only the "not counted" half is automated.

## Fixture dataset & expected numbers

Seeded by `seedAnalyticsFixture` (`apps/api/test/helpers/analytics-fixtures.ts`); numbers in `apps/api/test/fixtures/analytics-expected.ts`. Project tz `Asia/Ho_Chi_Minh`, range `2026-10-05T00:00+07:00` → `2026-10-12T00:00+07:00`, previous `2026-09-28` → `2026-10-05` (+07). Queries `q1` = "1zone", `q2` = "eventista". Unlisted labels default to relevant / neutral / safe / vi.

| Post | publishedAt (UTC) | Matches          | Analysis                                                      | Note                     |
| ---- | ----------------- | ---------------- | ------------------------------------------------------------- | ------------------------ |
| P01  | 10-05T03:00Z      | q1               | positive · praise · ticket                                    |                          |
| P02  | 10-05T04:00Z      | q1 + q2          | negative · sensitive · complaint, question · ticket, payment  | multi-query, multi-label |
| P03  | 10-06T03:00Z      | q2               | neutral · en · question · venue                               |                          |
| P04  | 10-06T05:00Z      | q1               | negative · severe · complaint · payment                       | A9 override target       |
| P05  | 10-06T17:00:00Z   | q1               | neutral                                                       | local 10-07 00:00        |
| P06  | 10-06T16:59:59Z   | q2               | positive · en · praise · venue                                | local 10-06 23:59:59     |
| P07  | 10-04T17:00:00Z   | q1               | AI negative, active override → neutral · complaint · ticket   | `from` inclusive, BR-025 |
| P08  | 10-11T17:00:00Z   | q1               | positive                                                      | `to` exclusive → out     |
| P09  | 10-08T03:00Z      | q1               | irrelevant (AI)                                               | BR-016                   |
| P10  | 10-08T04:00Z      | q1               | AI relevant, override → irrelevant                            | BR-025                   |
| P11  | 10-09T02:00Z      | q1 excluded      | relevant                                                      | A18, never counted       |
| P12  | 10-09T03:00Z      | q1 excluded + q2 | negative · complaint · ticket                                 | counts for q2 only       |
| P13  | 10-10T03:00Z      | q1               | pending                                                       | A4                       |
| P14  | 10-10T04:00Z      | q2               | failed                                                        |                          |
| P15  | 10-10T05:00Z      | q1               | uncertain                                                     | out by default           |
| P16  | 10-11T03:00Z      | q1               | positive · `fr` (→ other) · praise · artist; revoked override | revoked = no effect      |
| P17  | 09-30T03:00Z      | q1               | neutral                                                       | previous period          |
| X01  | 10-06T03:00Z      | other project    | negative · severe · complaint · ticket                        | scoping                  |

| Metric (default filters)          | Expected                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| mentionCount / previous / growth  | 9 (P01–P07, P12, P16) / 1 (P17) / +800 %, `up`                                     |
| Sentiment                         | positive 3, neutral 3, negative 3; denominator 9                                   |
| Safety                            | safe 7, sensitive 1, severe 1 → safety risk 2/9, severeCount 1                     |
| Intents                           | complaint 4, praise 3, question 2; denominator 8 → complaintRate 4/8 (Σ 9 > 8, A5) |
| Topics                            | ticket 4, payment 2, venue 2, artist 1                                             |
| Languages                         | vi 6, en 2, other 1                                                                |
| Query share                       | q1 6, q2 4; denominator 9 (overlap, A2)                                            |
| Timeseries day (10-05…10-11 +07)  | 3, 3, 1, 0, 1, 0, 1 (Σ 9)                                                          |
| Timeseries day, `timezone=UTC`    | 10-04…10-11 UTC: 1, 2, 4, 0, 0, 1, 0, 1                                            |
| Coverage                          | relevant 9, analyzed 12, pending 1, failed 1, irrelevant 2, uncertain 1            |
| `relevance=irrelevant`            | 2 (P09, P10)                                                                       |
| `sentiment=negative&topic=ticket` | 2 (P02, P12)                                                                       |
| A9: override P04 → neutral        | negative 2, neutral 4; revoke → back to the numbers above                          |

Sign-off: QC name, date, build, dataset, all rows pass or linked bugs.
