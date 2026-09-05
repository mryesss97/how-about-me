# 01 · Threads API POC — Plan, Checklist & Report Template (M1)

| Field  | Value                                                                                                                                                                                                    |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status | Plan approved; report pending (due 2026-09-19)                                                                                                                                                           |
| Source | [00-source/04_OPERATIONS_COSTS_ROADMAP.md](../00-source/04_OPERATIONS_COSTS_ROADMAP.md) §4                                                                                                               |
| Owner  | Tech Lead · Inputs: Product Owner (Meta developer account)                                                                                                                                               |
| Output | This file's §5 filled in + fixtures in `apps/api/src/modules/integrations/threads/__fixtures__/` + updates to [../02-architecture/06-ingestion-pipeline.md](../02-architecture/06-ingestion-pipeline.md) |

## 1. Why first

Source-data availability is the single highest risk (R01). No dashboard polish before this is answered.

## 2. Setup checklist (Meta)

- [ ] Meta developer account & business verification status known
- [ ] App created with **Threads** use case; app id/secret stored in owner's vault
- [ ] OAuth redirect configured; test user(s) added
- [ ] Scopes obtained: `threads_basic` + keyword search permission (name to be confirmed in docs), plus any reply-read scope for owned posts
- [ ] App Review requirements documented (what is required for production-intended access)
- [ ] Short-lived → long-lived token exchange tested; lifetime recorded
- [ ] Refresh behaviour tested (endpoint, lifetime, error when expired)

## 3. Search tests (record request, response sample, latency, counts)

| #   | Test           | q                   | mode    | type   | since/until | Expect / measure                                            |
| --- | -------------- | ------------------- | ------- | ------ | ----------- | ----------------------------------------------------------- |
| S1  | keyword recent | `1zone`             | KEYWORD | RECENT | none        | results, fields, cursor                                     |
| S2  | keyword recent | `eventista`         | KEYWORD | RECENT | none        |                                                             |
| S3  | tag recent     | `1zone`             | TAG     | RECENT | none        |                                                             |
| S4  | tag recent     | `eventista`         | TAG     | RECENT | none        |                                                             |
| S5  | top            | `eventista`         | KEYWORD | TOP    | none        | cursor present? ordering?                                   |
| S6  | window         | `eventista`         | KEYWORD | RECENT | last 24 h   | honoured? boundary inclusive?                               |
| S7  | window tag     | `eventista`         | TAG     | RECENT | last 7 d    | honoured for TAG?                                           |
| S8  | pagination     | `eventista`         | KEYWORD | RECENT | none        | max pages, page size limits, cursor stability               |
| S9  | empty          | `zzqxvbn1zone`      | KEYWORD | RECENT | none        | shape of empty response                                     |
| S10 | unicode        | `sự kiện eventista` | KEYWORD | RECENT | none        | encoding handling                                           |
| S11 | limit          | `eventista`         | KEYWORD | RECENT | none        | max `limit` accepted                                        |
| S12 | fields         | `eventista`         | KEYWORD | RECENT | none        | which requested fields are returned (see list in doc 06 §2) |

Measurements per test: result count; pages; latency p50/p95; lag post time → discoverability (compare `timestamp` to now on repeated polls every 10 min for 2 h); duplicate rate across polls and across KEYWORD vs TAG; historical depth actually returned; rate-limit headers (`x-app-usage`, `x-business-use-case-usage`, others); error payload shapes for 400/401/403/429.

## 4. Reply access tests

- [ ] `has_replies` present in search results?
- [ ] Replies endpoint works for posts owned by the authenticated account
- [ ] Replies endpoint behaviour for discovered third-party posts (expect permission error) — record exact error
- [ ] Document what App Review permits → update [../01-product/01-vision-scope.md §4.4](../01-product/01-vision-scope.md#44-explicit-non-goals-for-mvp) if anything changes

## 5. Report (fill in)

### 5.1 Access & permissions

| Item                                 | Finding |
| ------------------------------------ | ------- |
| Permission path for keyword search   |         |
| App Review needed before production? |         |
| Token type & lifetime                |         |
| Refresh endpoint & behaviour         |         |

### 5.2 Search behaviour

| Item                                       | Finding |
| ------------------------------------------ | ------- |
| Base URL / version used                    |         |
| Max `limit`                                |         |
| Pagination (cursor param names, max pages) |         |
| `since/until` honoured (KEYWORD / TAG)     |         |
| `TOP` cursor & ordering                    |         |
| Fields returned                            |         |
| Lag post → discoverable (median / p95)     |         |
| Duplicate rate across polls (10 min)       |         |
| Overlap KEYWORD vs TAG for same term       |         |
| Historical depth                           |         |
| Rate-limit headers & observed limits       |         |
| Error shapes (400/401/403/429/5xx)         |         |
| Deleted/unavailable content behaviour      |         |

### 5.3 Data quality (sample of 100 posts per term)

| Term              | Total | Clearly relevant | Irrelevant | Notes |
| ----------------- | ----- | ---------------- | ---------- | ----- |
| 1zone KEYWORD     |       |                  |            |       |
| 1zone TAG         |       |                  |            |       |
| eventista KEYWORD |       |                  |            |       |
| eventista TAG     |       |                  |            |       |

### 5.4 Replies

| Item | Finding |
| ---- | ------- |

### 5.5 Recommendations → parameter changes

| Parameter        | Doc default | Recommended | Reason |
| ---------------- | ----------- | ----------- | ------ |
| poll interval    | 600 s       |             |        |
| overlap          | 1200 s      |             |        |
| page limit       | 50          |             |        |
| max pages/job    | 50          |             |        |
| initial backfill | 1 day       |             |        |

## 6. Exit criteria (all ticked or waived by owner)

- [ ] Keyword search works via the production-intended permission path
- [ ] Pagination understood and documented
- [ ] Rate limiting measurable and documented
- [ ] Query/result quality acceptable (relevance ≥ ~50 % raw for at least one mode per term, or exclusion strategy defined)
- [ ] At least one reliable backfill strategy documented
- [ ] Third-party reply limitation explicitly documented
- [ ] ≥ 20 sanitised fixtures recorded (incl. empty page, multi-page, 429, 401)
