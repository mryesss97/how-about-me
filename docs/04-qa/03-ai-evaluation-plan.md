# 03 · AI Evaluation Plan (prompt/taxonomy v1 gate)

| Field   | Value                                                                                                                               |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Status  | Approved                                                                                                                            |
| Owner   | QC (labelling & report) · BA (guide) · Tech Lead (script)                                                                           |
| Targets | [../01-product/08-taxonomy-classification.md §11](../01-product/08-taxonomy-classification.md#11-evaluation-targets-v1-freeze-gate) |

## 1. Dataset `docs/04-qa/datasets/eval-v1.jsonl`

- ≥ 150 items (target 200) from POC fixtures + synthetic edge cases; pseudonymised usernames; no PII beyond public text.
- Coverage quotas: VI positive/neutral/negative ≥ 30 each; EN ≥ 20; mixed VI/EN ≥ 10; sarcasm ≥ 10; slang ≥ 10; complaints ≥ 20; ticket price ≥ 15; artist ≥ 15; spam/scalper ≥ 10; sensitive/severe (curated, may be synthetic) ≥ 10; irrelevant `1zone` false positives ≥ 15; emoji-only/empty ≥ 5.
- Record format:

```json
{
  "id": "ev-001",
  "text": "…",
  "matchedTerms": ["1zone"],
  "labels": {
    "relevance": "irrelevant",
    "sentiment": "neutral",
    "intents": ["information"],
    "topics": ["other"],
    "language": "en",
    "safetyLevel": "safe"
  },
  "notes": "time zone context",
  "labeler": "qc1",
  "secondLabeler": "ba1",
  "agreed": true
}
```

- Double labelling on 30 % sample; disagreements resolved by BA; inter-annotator agreement reported (Cohen's κ per dimension).

## 2. Labelling guide

Use definitions in taxonomy doc §2–§6 and §9; label intended attitude; multi-label allowed (max 4); `other` exclusive; safety labelled by policy semantics not gut feeling (severe = threats, minors, self-harm intent…).

## 3. Running

```bash
pnpm --filter @how-about-me/api eval:classifier -- --dataset ../../docs/04-qa/datasets/eval-v1.jsonl --out ../../docs/04-qa/eval-results/$(date +%F)-classifier-v1.md
```

Outputs per dimension: accuracy, precision/recall/F1 per label, confusion matrix, micro-F1 for multi-label, safety agreement + severe false negatives, average tokens & cost per item, latency.

## 4. Acceptance

All targets met → freeze `classifier-v1`, `taxonomy-v1`, `safety-policy-v1` (record in eval report + CHANGELOG). Any miss → prompt iteration (max 3 in M3) or owner waiver with documented risk (R02/R03).

## 5. Ongoing

Re-run on every prompt/model/policy change; keep results history; add misclassified production examples (from overrides, P1) to `eval-v2` candidates monthly.
