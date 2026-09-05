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

Sign-off: QC name, date, build, dataset, all rows pass or linked bugs.
