# 08 · Taxonomy, Classification & Safety Policy (v1)

| Field    | Value                                                                                                                                                                        |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status   | Approved for v1; frozen at M3 exit after evaluation                                                                                                                          |
| Source   | [00-source/01_PRODUCT_REQUIREMENTS.md](../00-source/01_PRODUCT_REQUIREMENTS.md) §9–§10 · [00-source/03_DATA_MODEL_AND_API.md](../00-source/03_DATA_MODEL_AND_API.md) §16–§17 |
| Code     | `packages/taxonomy` (labels, versions, guides) · `apps/api/src/modules/analysis/`                                                                                            |
| Versions | `taxonomy-v1`, `classifier-v1` (prompt), `safety-policy-v1`                                                                                                                  |

## 1. Dimensions overview

| Dimension | Cardinality     | Values                                              | Produced by             | Stored in                     |
| --------- | --------------- | --------------------------------------------------- | ----------------------- | ----------------------------- |
| Relevance | single          | `relevant`, `uncertain`, `irrelevant`               | ContentClassifier       | `post_analyses.relevance_*`   |
| Sentiment | single          | `positive`, `neutral`, `negative`                   | ContentClassifier       | `post_analyses.sentiment_*`   |
| Safety    | single + scores | `safe`, `sensitive`, `severe` + provider categories | SafetyProvider + policy | `post_analyses.safety_*`      |
| Intent    | multi           | 11 labels                                           | ContentClassifier       | `analysis_intents`            |
| Topic     | multi           | 12 labels                                           | ContentClassifier       | `analysis_topics`             |
| Language  | single          | ISO 639-1 subset                                    | ContentClassifier       | `post_analyses.language_code` |
| Summary   | text            | ≤ 240 chars                                         | ContentClassifier       | `post_analyses.summary`       |

## 2. Relevance (taxonomy-v1)

| Label        | Definition (labelling guide)                                                                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `relevant`   | The post is about 1Zone and/or Eventista (brand, event, artist line-up, tickets, venue, staff, app, membership…) or clearly about an experience with them.              |
| `uncertain`  | Mentions the term but context is insufficient (e.g. only a hashtag with an image, or ambiguous slang); or classifier confidence is low (< 0.60).                        |
| `irrelevant` | The term refers to something else ("time zone", "zone 1 parking", other brands named Eventista in other countries), or the text is empty/emoji-only with no brand link. |

Default analytics filter: `relevant`. `uncertain` can be toggled in.

## 3. Sentiment (taxonomy-v1)

| Label      | Guide                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------- |
| `positive` | Praise, excitement, gratitude, recommendation, satisfaction.                              |
| `neutral`  | Informational, questions without emotion, announcements, mixed with no dominant polarity. |
| `negative` | Complaint, disappointment, anger, sarcasm expressing dissatisfaction, boycott.            |

Sarcasm rule: label by the _intended_ attitude ("giá vé rẻ quá 🙃 500k một tấm" → negative). Mixed posts: pick dominant; if truly balanced → `neutral` (a future `mixed` label requires taxonomy-v2).

## 4. Intent (multi-label, taxonomy-v1)

| Label             | Guide                                                     | Typical VI cues                           |
| ----------------- | --------------------------------------------------------- | ----------------------------------------- |
| `praise`          | Positive evaluation of brand/event/artist/service         | "đỉnh", "quá đã", "xịn"                   |
| `complaint`       | Expresses a problem or dissatisfaction                    | "tệ", "lỗi", "chờ mãi", "lừa"             |
| `question`        | Asks for information                                      | "có ai biết", "bao giờ", "?"              |
| `recommendation`  | Recommends to others / asks others to buy or attend       | "nên đi", "mua ngay"                      |
| `purchase_intent` | Expresses intention to buy tickets/merch/membership       | "sẽ mua", "săn vé", "mở bán là chốt"      |
| `boycott`         | Refuses to buy/attend or urges others not to              | "tẩy chay", "không bao giờ mua nữa"       |
| `spam`            | Promotional/irrelevant repetitive content, scalping, bots | "pass vé giá rẻ inbox", links only        |
| `information`     | Shares news/facts/schedules                               | "line-up", "mở bán lúc"                   |
| `support_request` | Asks the brand for help with an order/account             | "hoàn tiền", "chưa nhận vé", "liên hệ ai" |
| `comparison`      | Compares with another event/brand/platform                | "so với", "hơn hẳn"                       |
| `other`           | None of the above (must be the only label when used)      | —                                         |

Rules: ≥ 1 label; `other` cannot co-occur; `spam` may co-occur with `recommendation`/`information` (scalper posts).

## 5. Topic (multi-label, taxonomy-v1)

| Label              | Guide                                                      |
| ------------------ | ---------------------------------------------------------- |
| `artist`           | Performers, line-up, guest artists                         |
| `ticket`           | Ticket availability, sale, categories, delivery, resale    |
| `venue`            | Location, seating, facilities, sound, access               |
| `price`            | Ticket/merch/membership pricing, value for money           |
| `performance`      | Show quality, set list, stage production                   |
| `membership`       | Membership/fan club/loyalty program                        |
| `payment`          | Payment methods, failures, refunds                         |
| `queue`            | Waiting lines, online queue, check-in flow                 |
| `customer_service` | Staff, support responsiveness, communication               |
| `event`            | Event as a whole: schedule, announcement, organisation     |
| `merchandise`      | Merch availability, quality, price (co-label with `price`) |
| `other`            | None of the above (must be the only label when used)       |

Rules: ≥ 1 label; `other` exclusive.

## 6. Language

`vi`, `en`, `ko`, `ja`, `th`, `zh`, `other`, `unknown`. Mixed VI/EN → dominant language of the message body; hashtags ignored. Emoji-only → `unknown`.

## 7. Summary & explanation

- Summary: one sentence, ≤ 240 chars, third person, no hashtags, in **English** (v1 decision for consistent scanning; VI display is a P2 option).
- Relevance explanation: ≤ 200 chars, user-facing ("Complaint about ticket price."). No reasoning traces.

## 8. Confidence policy (v1)

| Band   | Range     | Behaviour                                                                                       |
| ------ | --------- | ----------------------------------------------------------------------------------------------- |
| high   | ≥ 0.80    | auto-accept                                                                                     |
| medium | 0.60–0.79 | accepted; UI shows a subtle "medium confidence" marker                                          |
| low    | < 0.60    | relevance → treated as `uncertain`; other dimensions kept but item appears in review queue (P1) |

`overall_model_confidence = min(relevance.confidence, sentiment.confidence)` for list sorting. Bands live in `analysis_settings` (P1 configurable; v1 constants in `packages/taxonomy`).

## 9. Safety policy v1 (`safety-policy-v1`)

Provider: OpenAI `omni-moderation-latest` → categories with scores in `[0,1]`.

| Category                 | Sensitive threshold | Severe threshold |
| ------------------------ | ------------------- | ---------------- |
| `harassment`             | ≥ 0.50              | —                |
| `harassment/threatening` | ≥ 0.30              | ≥ 0.70           |
| `hate`                   | ≥ 0.40              | ≥ 0.80           |
| `hate/threatening`       | ≥ 0.30              | ≥ 0.60           |
| `sexual`                 | ≥ 0.50              | —                |
| `sexual/minors`          | —                   | ≥ 0.30           |
| `violence`               | ≥ 0.50              | ≥ 0.85           |
| `violence/graphic`       | ≥ 0.40              | ≥ 0.80           |
| `self-harm`              | ≥ 0.30              | ≥ 0.70           |
| `self-harm/intent`       | —                   | ≥ 0.40           |
| `self-harm/instructions` | —                   | ≥ 0.40           |
| `illicit`                | ≥ 0.50              | —                |
| `illicit/violent`        | ≥ 0.40              | ≥ 0.70           |

Mapping: `severe` if any severe threshold crossed; else `sensitive` if any sensitive threshold crossed or provider `flagged=true`; else `safe`. Thresholds are starting points; QC tunes them against the evaluation set before M3 exit; every change bumps the policy version. Sentiment is never an input to this mapping (BR-017).

## 10. Versioning & migration rules

- `taxonomy_version` changes when any label is added/removed/redefined. Old analyses stay valid but are `stale`-eligible for re-analysis.
- `prompt_version` changes when the prompt text/schema/model instructions change.
- `safety_policy_version` changes when thresholds or provider mapping change.
- Effective version key: `classifier_provider|classifier_model|prompt_version|taxonomy_version|safety_provider|safety_model|safety_policy_version`.
- Unknown labels from the model are rejected (validation), never silently stored.

## 11. Evaluation targets (v1 freeze gate)

| Dimension    | Metric                    | Target                                                             |
| ------------ | ------------------------- | ------------------------------------------------------------------ |
| Relevance    | accuracy vs analyst label | ≥ 0.85; `irrelevant` recall ≥ 0.80                                 |
| Sentiment    | accuracy                  | ≥ 0.75 on VI set                                                   |
| Intent       | micro-F1                  | ≥ 0.70                                                             |
| Topic        | micro-F1                  | ≥ 0.70                                                             |
| Safety level | agreement                 | ≥ 0.90; zero `severe` false negatives on the curated severe subset |

Details in [../04-qa/03-ai-evaluation-plan.md](../04-qa/03-ai-evaluation-plan.md).
