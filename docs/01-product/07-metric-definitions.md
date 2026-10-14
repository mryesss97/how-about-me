# 07 · Metric & KPI Definitions

| Field          | Value                                                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Status         | Approved (baseline v1.0) — definitions are frozen; changes require a new `metrics_version`                                                                                     |
| Source         | [00-source/01_PRODUCT_REQUIREMENTS.md](../00-source/01_PRODUCT_REQUIREMENTS.md) §11, §16–§17 · [00-source/03_DATA_MODEL_AND_API.md](../00-source/03_DATA_MODEL_AND_API.md) §19 |
| Implemented in | `apps/api/src/modules/analytics/` · verified by [../04-qa/02-analytics-qa-checklist.md](../04-qa/02-analytics-qa-checklist.md)                                                 |

## 0. Conventions

- **Range** `[from, to)` in the selected timezone (default project timezone). `from` inclusive, `to` exclusive.
- **Time field** used for bucketing and range membership: `social_posts.published_at` (post time on Threads), **not** `first_seen_at`. Rationale: analysts reason about when people posted. `first_seen_at` is available as an alternative `timeField=first_seen_at` for ingestion-lag analysis (P1).
- **Base set** `B` = mentions in range where effective relevance ∈ selected relevance filter (default `{relevant}`) and other selected filters match (query, language, …), and `excluded_by_terms=false` for at least one matched query in the filter.
- **Effective analysis** = `effective_post_analysis` view (override > latest completed run). Intents/topics: `effective_post_intents|topics` views (an active override replaces the AI label set, T-142). Pending/failed posts have no AI labels (only analyst overrides, if any).
- **Distinctness** — project-wide numbers use `COUNT(DISTINCT post_id)`. Per-query breakdowns count a post once per matched query.
- All rates are returned as decimals in `[0,1]` with the denominator; UI formats as %.

## 1. KPI cards (P0)

### 1.1 Total Relevant Mentions

```text
mentionCount = COUNT(DISTINCT post_id) FROM B
```

Denominator shown in tooltip: "distinct posts published in range with relevance = relevant".

### 1.2 Mention Growth vs previous period

```text
previous = mentionCount over previous equal-length window
growth   = (current − previous) / previous
if previous = 0 → kpis.mentionCount.growthPct = null, growthState = "new" (UI shows "New")
if previous > 0 → growthState = "up" | "down" | "flat" (|growth| < 0.005 → flat)
```

Wire unit (#211): `kpis.mentionCount.growthPct = round(growth × 100, 1)` — already a percent (`162.5` = +162.5 %); the UI must not multiply it again. The flat threshold applies to the ratio (`|growth| < 0.005`, i.e. 0.5 %). Rates (§2) are ratios 0..1 and the UI multiplies by 100 once.

### 1.3 Positive Rate

```text
sentimentAnalyzed = COUNT(DISTINCT post_id) FROM B WHERE effective.sentiment_label IS NOT NULL
positiveRate      = COUNT(DISTINCT post_id WHERE sentiment_label='positive') / sentimentAnalyzed
```

Denominator: "relevant mentions with a completed sentiment label". If denominator = 0 → `null`, UI shows "—".

### 1.4 Negative Rate

Same denominator as 1.3 with `sentiment_label='negative'`.

### 1.5 Sensitive + Severe Rate (safetyRiskRate)

```text
safetyAnalyzed = COUNT(DISTINCT post_id) FROM B WHERE effective.safety_level IS NOT NULL
safetyRiskRate = COUNT(DISTINCT post_id WHERE safety_level IN ('sensitive','severe')) / safetyAnalyzed
severeCount    = COUNT(DISTINCT post_id WHERE safety_level='severe')   -- shown separately when > 0
```

### 1.6 Complaint Rate

```text
intentAnalyzed = COUNT(DISTINCT post_id) FROM B WHERE post has ≥1 effective intent label
complaintRate  = COUNT(DISTINCT post_id WHERE 'complaint' ∈ effective.intents) / intentAnalyzed
```

### 1.7 Optional cards

- `uncertainCount` = distinct posts in range with relevance `uncertain` (regardless of default filter).
- `analysisCoverage` = `analyzedMentions / (analyzedMentions + pendingMentions + failedMentions)` over range, relevance filter ignored for pending (unknown yet).

## 2. Coverage block (always returned with overview)

```text
relevantMentions = mentionCount
analyzedMentions = distinct posts in range with a completed effective analysis (any relevance)
pendingMentions  = distinct posts in range whose latest run status ∈ {pending, processing}
failedMentions   = distinct posts in range whose latest run status = failed
irrelevantMentions = distinct posts in range with relevance = irrelevant   (for transparency)
uncertainMentions  = distinct posts in range with relevance = uncertain    (for transparency)
```

Coverage counts (except `relevantMentions`) ignore relevance, analysis-status and label filters (pending/failed posts have no labels); query and time filters still apply. A post that already has an effective analysis counts as analyzed even while a re-run is pending, so pending/failed count only posts without one.

Plus `dataQuality`: `lastSyncStatus` (success/partial/failed/none in last 2 × max poll interval of enabled queries, default 600 s), `integrationStatus` (Threads connection; no row → `disconnected`), `collectorStatus`:

- `paused` — collector circuit breaker open (`collector_state.circuit_open_until > now`);
- `degraded` — `lastSyncStatus ∈ {failed, partial}` or Threads integration ≠ `connected`;
- `healthy` — otherwise.

`kpis.mentionCount.previous/growthPct/growthState` are always returned (growth vs the previous period, §5) even when `compare=false`; rate `previous` values and `range.previous` only when `compare=true`.

## 3. Charts (P0)

### 3.1 Mentions over time

- Bucket: `hour` if range ≤ 48 h, else `day`; computed with `date_trunc(bucket, published_at AT TIME ZONE tz)`.
- Series: `mentions` = distinct posts per bucket from `B`. Zero-filled. Optional `previous` series aligned by offset when `compare=true`.
- Bucketing uses the filter's `timeField` (`published_at` default, or `first_seen_at`).
- Zero-fill: `generate_series` over local time from `date_trunc(bucket, from AT TIME ZONE tz)` to `date_trunc(bucket, (to − 1 µs) AT TIME ZONE tz)`, step 1 bucket, converted back with `AT TIME ZONE tz` and de-duplicated (DST-safe: one bucket per local day/hour; the skipped local hour on a spring-forward day yields no extra bucket). The first bucket may start before `from` (partial); the last bucket is the one containing `to − ε`. `sum(mentions) = |B|`.
- `previous`: computed on the previous period (§5) with the **same** interval, aligned by bucket position (bucket i ↔ bucket i); missing → 0, extra buckets dropped (only around DST).

### 3.2 Sentiment distribution

`positive / neutral / negative` counts and shares over `sentimentAnalyzed`. `positive + neutral + negative = sentimentAnalyzed` (invariant checked in QA).

### 3.3 Sentiment over time

Per bucket: counts for each label (`COUNT(DISTINCT post_id)` from `B`, same buckets and zero-fill as §3.1, no `previous`); stacked or 100 % stacked in UI (toggle).

### 3.4 Safety distribution

`safe / sensitive / severe` counts and shares over `safetyAnalyzed`. Invariant: sum = `safetyAnalyzed`.

### 3.5 Top topics

For each topic label: `COUNT(DISTINCT post_id)` in `B` with that effective topic. Share = count / `topicAnalyzed` (posts with ≥ 1 topic). Shares may sum > 100 %. Return top 12 sorted desc, plus `other`. Ranking covers real labels only (taxonomy label `other` excluded; ties by taxonomy order). The `other` bucket = `COUNT(DISTINCT post_id)` of posts tagged `other` **or** with any label outside the top 12 — a distinct count, never the sum of per-label counts.

### 3.6 Intent distribution

Same as 3.5 on intents (denominator `intentAnalyzed`); all labels returned, count 0 included, sorted by count desc (ties by taxonomy order).

## 4. Charts (P1)

- **Language distribution**: distinct posts per `language_code` over posts with a language (`language_code IS NOT NULL`, `unknown` included; posts not yet analysed are excluded). Codes outside the taxonomy count as `other`; all 8 codes are listed, sorted by count desc (ties in taxonomy order). Filter `language=other` matches the same set (stored `other` or any non-NULL code outside the taxonomy) — drill-down equivalence (#201).
- **Topic × sentiment** (T-149): matrix `topic → {positive, neutral, negative}` distinct counts; denominator per row = posts with that topic and a sentiment (`total = positive + neutral + negative`). Topics are effective labels (override > AI, BR-025), sentiment is the effective sentiment of `B`. All 12 taxonomy labels are returned (count 0 included); `other` = posts tagged `other` (a real label here, not the top-12 remainder of §3.5). Labels outside the taxonomy are ignored. Sorted `total` desc, ties in taxonomy order, `other` last. A post with a topic but no sentiment is not counted, so a row `total` can be lower than the same topic in Top topics. Multi-label: a post counts once in each of its topic rows, so the row totals are not summed.
- **Negative-topic contributors** (T-149): topics ranked by `negativeCount` and `negativeShareWithinTopic = negativeCount / topicSentimentAnalyzed` (= `rows[].negativeShare`, null when the row total = 0, FR-140). The UI lists only topics with `negative > 0`, ranked `negative` desc, ties by share desc; no top-N cut.
- **Keyword share**: distinct posts per query (overlap allowed); tooltip explains overlap. Denominator = distinct posts in `B` (= mentionCount). A query counts only its matches with `excluded_by_terms=false`. Lists every non-deleted query (count 0 included) plus soft-deleted queries with count > 0 (BR-010); with `queryIds` exactly those queries. Sorted count desc, then display name.

- **Sentiment map** (#222): derived on the FE from Topic × sentiment, no extra request. One bubble per topic with `total > 0`; area ∝ `total`; dominant = argmax(positive, neutral, negative) with tie-break negative > positive > neutral; dominant share = dominant / `total`. Radius floor = 25 % of the largest radius (tiny topics are not to scale; the table has exact numbers). Multi-label: bubble totals are never summed; "N topics" counts bubbles, not posts.
- **Phrase × sentiment** (#223, FR-148): `GET …/analytics/phrases`. Per key phrase of the **current** analysis (`analysis_phrases`, BR-041; no overrides on phrases) × effective sentiment of `B` (BR-025): DISTINCT posts per cell; `total = positive + neutral + negative`; `negativeShare = negative / total` (`null` when 0, FR-140). Posts without sentiment are not counted. Rows kept when `total ≥ minMentions` (query param 1–1000; omitted → project setting `phraseMinMentions`, 1–50, default 2; #251), sorted `total` desc then phrase (code-point order), cut at `limit` (default 30, max 100); no `other` bucket (the rest is not drillable). Scalars: `sentimentAnalyzed` = DISTINCT posts in `B` with a sentiment; `phraseAnalyzed` = those with ≥ 1 phrase; `totalPhrases` = rows meeting the threshold before the cut. `phraseAnalyzed = 0` with `sentimentAnalyzed > 0` means the period was analysed before phrase extraction (classifier-v1) — not "0 mentions". Multi-label: a post counts once in each of its phrase rows; row totals are never summed. Sentiment is the post's overall sentiment, not per aspect.

## 5. Previous-period math

```text
len      = to − from
prevFrom = from − len
prevTo   = from
```

Boundaries computed in the selected timezone, then converted to UTC for SQL. DST does not apply to `Asia/Ho_Chi_Minh` but the implementation must be generic (`@date-fns/tz` + `date-fns` in the API, Postgres `AT TIME ZONE` in SQL).

Rule (`apps/api/src/common/time/range.ts` `previousPeriodInTz`): when both `from` and `to` fall exactly on local midnight in the selected timezone, step back by the same number of **calendar days** (DST-safe, so `prevFrom` is also a local midnight); otherwise step back by `len` in milliseconds. For `Asia/Ho_Chi_Minh` and `UTC` both give the same result.

## 6. Drill-down equivalence

Each metric maps to a mentions filter that returns exactly the counted posts:

| Metric / segment              | Mentions filters                                     |
| ----------------------------- | ---------------------------------------------------- |
| mentionCount                  | `from,to,relevance=relevant` + active global filters |
| mention growth                | same as mentionCount (current period)                |
| positive segment              | `+ sentiment=positive`                               |
| negative segment              | `+ sentiment=negative`                               |
| sensitive+severe              | `+ safety=sensitive,severe`                          |
| safety `severe`               | `+ safety=severe`                                    |
| topic `ticket`                | `+ topic=ticket`                                     |
| intent `complaint`            | `+ intent=complaint` (also complaint rate)           |
| query share bar q             | `queryIds=q` (replaces global `queryIds`)            |
| topic × sentiment cell (t, s) | `+ topic=t&sentiment=s`                              |
| negative contributor t        | `+ topic=t&sentiment=negative`                       |
| sentiment map bubble t        | `+ topic=t`                                          |
| sentiment map detail (t, s)   | `+ topic=t&sentiment=s`                              |
| phrase bubble p               | `+ phrase=p`                                         |
| phrase detail (p, s)          | `+ phrase=p&sentiment=s`                             |
| timeseries bucket             | `from=bucketStart,to=bucketEnd`                      |
| previous period               | `from=prevFrom,to=prevTo`                            |

For rates the list returns the numerator posts. Topic `other` is the top-12 remainder and has no filter, so it is not drillable. Language `other` is drillable: `language=other` matches stored `other` plus any non-NULL code outside the taxonomy, the same set the slice counts (#201). In the topic × sentiment matrix (T-149) `other` is a real label and is drillable (`topic=other`). Cell values replace the global `topic`/`sentiment` keys (as for every segment), so with a global `topic` filter active a cell of another topic can count fewer posts than its list (the matrix counts posts with both topics). Phrase rows (#223): `phrase=p` matches posts whose current analysis has phrase `p` (normalised per BR-041 on the server, so a copied link always matches). The list does not require a sentiment, but every completed v2 analysis that has phrases is a full (non-irrelevant) analysis with a sentiment, so `/mentions?phrase=p` totals equal the row `total`; an AI-irrelevant post overridden to relevant has no phrases and never appears in either. FE mapping: `apps/web/src/lib/filters/drill-down.ts` (T-102).

QA reconciles list totals (`totalCount` header from `/mentions?count=true`) against chart numbers. Automated on the shared fixture (T-094): `apps/api/test/integration/analytics/fixture-equivalence.int-spec.ts`, expected numbers in `apps/api/test/fixtures/analytics-expected.ts`.

## 7. Operational metrics

```text
collection_lag_seconds = now() − MAX(last_successful_sync_at) over enabled, non-deleted queries   (null if none)
analysis_lag_seconds   = now() − MIN(created_at) over analysis_runs WHERE status IN ('pending','processing')  (0 if none)
sync_success_rate_24h  = success / (success + partial + failed) over sync_jobs completed in last 24 h
duplicate_rate_24h     = Σ records_duplicated / Σ records_fetched over last 24 h
analysis_failure_rate_24h = failed / (completed + failed + skipped) over runs completed in last 24 h
ai_cost_24h_usd        = Σ estimated_cost_usd over runs completed in last 24 h
```

## 8. Worked example

Range 2026-09-04 00:00 → 2026-09-05 00:00 (+07:00), relevance = relevant.

| Item                              | Value                                                |
| --------------------------------- | ---------------------------------------------------- |
| Distinct relevant posts           | 2 481                                                |
| With sentiment                    | 2 410 (61 pending, 10 failed)                        |
| Positive / Neutral / Negative     | 1 494 / 482 / 434 → 62.0 % / 20.0 % / 18.0 %         |
| With safety                       | 2 410; sensitive 68, severe 9 → safetyRiskRate 3.2 % |
| With intents                      | 2 410; complaint 675 → 28.0 %                        |
| Previous period distinct relevant | 2 043 → growth +21.4 %                               |

`positive + neutral + negative = 2 410 ✓` · `analyzed + pending + failed` = all in-range posts with an analysis run (any relevance, §2); it equals `relevantMentions` here only because the example has no irrelevant/uncertain posts.

## 9. Change control

Any change to a formula, denominator, time field or default filter requires: update this doc, bump `METRICS_VERSION` (returned in overview `meta.metricsVersion`), add a note to the release notes, and re-run the analytics QA checklist.
