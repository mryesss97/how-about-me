# Classifier evaluation — fake-v1

> ⚠️ **Fake providers — không phải kết quả freeze.** Chỉ chứng minh pipeline đánh giá chạy được.

- Generated (UTC): 2026-10-13T10:31:37.371Z
- Dataset: `src/cli/eval/__fixtures__/eval-draft.jsonl` (sha256 `9ecca0cc30563308ebe31dcfa838e647798bc8eb4050e2cffa081bdd4384f4ca`), 20 item(s), 0 error(s)
- Providers mode: `fake`
- Classifier: `fake` / `fake-classifier-v1`, prompt `fake-v1`
- Safety: `fake` / `fake-moderation-v1`
- Taxonomy `taxonomy-v1`, safety policy `safety-policy-v1`
- Brand context: sha256 `ab2d2ec817b0`, 83 chars

## Freeze gate (doc 08 §11)

| Metric                          | Value | Target | Result |
| ------------------------------- | ----- | ------ | ------ |
| Relevance accuracy              | 1.000 | ≥ 0.85 | PASS   |
| Relevance `irrelevant` recall   | 1.000 | ≥ 0.8  | PASS   |
| Sentiment accuracy (VI)         | 0.714 | ≥ 0.75 | FAIL   |
| Intent micro-F1                 | 0.541 | ≥ 0.7  | FAIL   |
| Topic micro-F1                  | 0.902 | ≥ 0.7  | PASS   |
| Safety agreement                | 1.000 | ≥ 0.9  | PASS   |
| Severe false negatives (BR-018) | 0 / 2 | = 0    | PASS   |

Overall: **FAIL**

## Relevance

n=20, accuracy 1.000, macro-F1 1.000

| Label      | Precision | Recall | F1    | Support |
| ---------- | --------- | ------ | ----- | ------- |
| relevant   | 1.000     | 1.000  | 1.000 | 16      |
| uncertain  | 1.000     | 1.000  | 1.000 | 1       |
| irrelevant | 1.000     | 1.000  | 1.000 | 3       |

Confusion (rows = gold, columns = pred):

| gold \ pred | relevant | uncertain | irrelevant |
| ----------- | -------- | --------- | ---------- |
| relevant    | 16       | 0         | 0          |
| uncertain   | 0        | 1         | 0          |
| irrelevant  | 0        | 0         | 3          |

## Sentiment (VI subset n=14, accuracy 0.714)

n=17, accuracy 0.765, macro-F1 0.763

| Label    | Precision | Recall | F1    | Support |
| -------- | --------- | ------ | ----- | ------- |
| positive | 0.800     | 1.000  | 0.889 | 4       |
| neutral  | 0.667     | 1.000  | 0.800 | 6       |
| negative | 1.000     | 0.429  | 0.600 | 7       |

Confusion (rows = gold, columns = pred):

| gold \ pred | positive | neutral | negative |
| ----------- | -------- | ------- | -------- |
| positive    | 4        | 0       | 0        |
| neutral     | 0        | 6       | 0        |
| negative    | 1        | 3       | 3        |

## Intents

n=17, micro-P 0.526, micro-R 0.556, micro-F1 0.541, macro-F1 0.766, exact match 0.471

| Label           | Precision | Recall | F1    | Support |
| --------------- | --------- | ------ | ----- | ------- |
| praise          | 0.667     | 0.500  | 0.571 | 4       |
| complaint       | 1.000     | 0.333  | 0.500 | 6       |
| question        | 1.000     | 0.750  | 0.857 | 4       |
| recommendation  | 0.000     | —      | —     | 0       |
| purchase_intent | 1.000     | 1.000  | 1.000 | 1       |
| spam            | 1.000     | 0.500  | 0.667 | 2       |
| information     | 0.000     | —      | —     | 0       |
| support_request | 0.000     | —      | —     | 0       |
| comparison      | 1.000     | 1.000  | 1.000 | 1       |

## Topics

n=17, micro-P 0.885, micro-R 0.920, micro-F1 0.902, macro-F1 0.837, exact match 0.824

| Label            | Precision | Recall | F1    | Support |
| ---------------- | --------- | ------ | ----- | ------- |
| artist           | 1.000     | 1.000  | 1.000 | 1       |
| ticket           | 1.000     | 1.000  | 1.000 | 5       |
| venue            | —         | 0.000  | —     | 1       |
| price            | 0.667     | 1.000  | 0.800 | 2       |
| performance      | 1.000     | 0.500  | 0.667 | 2       |
| membership       | 1.000     | 1.000  | 1.000 | 1       |
| payment          | 1.000     | 1.000  | 1.000 | 2       |
| queue            | 1.000     | 1.000  | 1.000 | 3       |
| customer_service | 1.000     | 1.000  | 1.000 | 1       |
| event            | 0.833     | 1.000  | 0.909 | 5       |
| merchandise      | 1.000     | 1.000  | 1.000 | 1       |
| other            | 0.500     | 1.000  | 0.667 | 1       |

## Safety level (agreement 1.000)

n=20, accuracy 1.000, macro-F1 1.000

| Label     | Precision | Recall | F1    | Support |
| --------- | --------- | ------ | ----- | ------- |
| safe      | 1.000     | 1.000  | 1.000 | 16      |
| sensitive | 1.000     | 1.000  | 1.000 | 2       |
| severe    | 1.000     | 1.000  | 1.000 | 2       |

Confusion (rows = gold, columns = pred):

| gold \ pred | safe | sensitive | severe |
| ----------- | ---- | --------- | ------ |
| safe        | 16   | 0         | 0      |
| sensitive   | 0    | 2         | 0      |
| severe      | 0    | 0         | 2      |

Severe subset n=2; false negatives: none

## Usage & latency

- Tokens: 650 in / 1920 out; avg 128.5 per item
- Cost (USD): total 0.000000, avg 0.000000 per item (giá chưa cấu hình — `ANALYSIS_PRICE_*` = 0)
- Latency per item (ms): p50 0.1, p95 3.8

## Mismatches

| Id          | Dimension | Gold                     | Pred                                    |
| ----------- | --------- | ------------------------ | --------------------------------------- |
| `draft-015` | sentiment | negative                 | neutral                                 |
| `draft-016` | sentiment | negative                 | neutral                                 |
| `draft-017` | sentiment | negative                 | neutral                                 |
| `draft-019` | sentiment | negative                 | positive                                |
| `draft-005` | intents   | praise                   | support_request                         |
| `draft-006` | intents   | purchase_intent,question | purchase_intent,question,recommendation |
| `draft-008` | intents   | praise                   | information                             |
| `draft-014` | intents   | spam                     | information                             |
| `draft-015` | intents   | complaint                | information                             |
| `draft-016` | intents   | complaint                | information                             |
| `draft-017` | intents   | complaint                | information                             |
| `draft-019` | intents   | complaint                | praise                                  |
| `draft-020` | intents   | question                 | information                             |
| `draft-008` | topics    | artist,performance       | artist,event                            |
| `draft-014` | topics    | ticket                   | price,ticket                            |
| `draft-016` | topics    | venue                    | other                                   |
