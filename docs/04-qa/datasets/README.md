# Evaluation datasets

- `eval-v1.jsonl` — labelled evaluation set for prompt/taxonomy v1 (built in M3, see ../03-ai-evaluation-plan.md). Not committed until pseudonymised and reviewed.
- Record schema: see ../03-ai-evaluation-plan.md §1, validated by `apps/api/src/cli/eval/dataset.ts` (labels use the taxonomy enums; `sentiment`/`intents`/`topics`/`language` optional, `relevance`/`safetyLevel` required; optional `tags: string[]`).
- Draft synthetic set (20 items, no real user data) for exercising the CLI: `apps/api/src/cli/eval/__fixtures__/eval-draft.jsonl`.
