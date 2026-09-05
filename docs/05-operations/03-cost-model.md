# 03 · Cost Model

| Field  | Value                                                                                              |
| ------ | -------------------------------------------------------------------------------------------------- |
| Status | Estimate — finalise after POC measurements                                                         |
| Source | [00-source/04_OPERATIONS_COSTS_ROADMAP.md](../00-source/04_OPERATIONS_COSTS_ROADMAP.md) §1–§3, §12 |

## 1. Fixed / platform

| Item                            | Local/POC | Staging        | Production          | Notes                                                        |
| ------------------------------- | --------- | -------------- | ------------------- | ------------------------------------------------------------ |
| Threads API                     | $0        | $0             | $0                  | no published per-request fee (re-check before launch)        |
| Supabase                        | Free      | Free → Pro $25 | Pro $25             | Pro: 8 GB disk, 250 GB egress, backups; overage $0.125/GB/mo |
| OpenAI Moderation               | $0        | $0             | $0                  | `omni-moderation-latest` free                                |
| Web hosting (Vercel Hobby/Pro)  | $0        | $0–20          | $0–20               | Pro if team seats needed                                     |
| API/worker host                 | $0        | ~$5–10         | ~$10–25             | small always-on instance                                     |
| Logs/monitoring                 | $0        | free tiers     | free tiers → ~$0–20 |                                                              |
| **Subtotal (excl. classifier)** | **$0**    | **~$5–55**     | **~$35–90 / month** |                                                              |

## 2. Classifier (variable)

```text
analyzed_posts = discovered_posts × (1 − duplicate_rate) × (relevant_or_uncertain_share + irrelevant_share × gate_fraction)
input_tokens   = analyzed_posts × (prompt_overhead ≈ 900 + post_tokens ≈ 120)
output_tokens  = analyzed_posts × ≈ 120
cost           = input_tokens/1M × price_in + output_tokens/1M × price_out
```

Illustrative (small structured-output model, price assumptions to be filled with the chosen model): 5 000 analysed posts/month ≈ 5.1 M input + 0.6 M output tokens → typically **< $5/month** at small-model prices; 50 000/month → tens of dollars. Two-step (relevance first) reduces classifier tokens for irrelevant posts by ~85 %.

Guardrails: `ANALYSIS_DAILY_BUDGET_USD`, version dedupe, relevance gate, spam summary skip.

## 3. Storage planning

| Posts | Rough size (rows + JSONB + indexes + analyses) |
| ----- | ---------------------------------------------- |
| 10 k  | tens–low hundreds MB                           |
| 100 k | hundreds MB – ~1 GB                            |
| 1 M   | several GB (Pro disk overage begins > 8 GB)    |

Measure `average_storage_bytes_per_post` monthly; retention 12 months keeps MVP well within Pro.

## 4. People (for planning only)

10 weeks × (1 lead + 1 BE + 1 FE + 1 QC + 0.4 BA) — the dominant MVP cost; infra is secondary.

## 5. Actions

- [ ] Choose classifier model & fill prices (owner input) · [ ] Measure POC token averages · [ ] Decide hosting · [ ] Set budgets in env per environment
