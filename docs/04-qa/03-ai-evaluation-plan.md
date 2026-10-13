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

Outputs per dimension: accuracy, precision/recall/F1 per label, macro-F1, confusion matrix, micro-F1 (+ macro-F1, exact match) for multi-label, safety agreement + severe false negatives, average tokens & cost per item, latency.

CLI (T-079, `apps/api/src/cli/eval-classifier.ts`; paths relative to `apps/api`):

| Flag                     | Meaning                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `--dataset <path>`       | JSONL dataset (required). Any invalid line aborts with line number + id.            |
| `--out <path>`           | Markdown report (default stdout).                                                   |
| `--json <path>`          | Raw per-item predictions + summary (ids and labels only) for diffing runs.          |
| `--brand-context <text>` | Overrides `ANALYSIS_BRAND_CONTEXT`. Report records only its sha256 prefix + length. |
| `--limit N`              | Evaluate the first N items (cheap trial run in real mode).                          |
| `--concurrency N`        | Parallel items, default 2, max 10.                                                  |
| `--fail-on-gate`         | Exit 1 when any §11 gate fails (for future CI).                                     |

- Providers come from the runtime factories: `PROVIDERS_MODE=fake` (default) runs offline; `real` needs `OPENAI_API_KEY` + `ANALYSIS_CLASSIFIER_MODEL`. Cost is 0 unless `ANALYSIS_PRICE_*` are set (report says so).
- Exit 0 when the run completes, even with gate FAIL (gate is information for QC); exit 1 on argument, dataset or config errors.
- Report: header (UTC time, dataset sha256, providers/model, prompt/taxonomy/safety-policy versions), freeze-gate table (doc 08 §11, PASS/FAIL), per-dimension tables + confusion, usage/latency (p50/p95), errors, mismatches. Items are identified by `id` only — item text never appears in the report or logs.
- Items whose gold lacks a dimension (e.g. no `sentiment` on `irrelevant`) are excluded from that dimension. VI sentiment subset and the severe subset are derived from gold `labels.language === "vi"` / `labels.safetyLevel === "severe"`. Optional `tags: string[]` per record is accepted for grouping (not used by the gate). A provider error on one item is recorded and the run continues.
- Draft synthetic fixture: `apps/api/src/cli/eval/__fixtures__/eval-draft.jsonl`; fake-mode sample report: `eval-results/2026-10-13-classifier-v1-draft-fake.md` (not a freeze result).

```bash
PROVIDERS_MODE=fake pnpm --filter @how-about-me/api eval:classifier -- --dataset src/cli/eval/__fixtures__/eval-draft.jsonl --out ../../docs/04-qa/eval-results/$(date +%F)-classifier-v1-draft-fake.md
```

## 4. Acceptance

All targets met → freeze `classifier-v1`, `taxonomy-v1`, `safety-policy-v1` (record in eval report + CHANGELOG). Any miss → prompt iteration (max 3 in M3) or owner waiver with documented risk (R02/R03).

## 5. Ongoing

Re-run on every prompt/model/policy change; keep results history; add misclassified production examples (from overrides, P1) to `eval-v2` candidates monthly.
