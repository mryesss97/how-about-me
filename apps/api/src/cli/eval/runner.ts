import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import {
  INTENT_LABELS,
  RELEVANCE_LABELS,
  SAFETY_LEVELS,
  SENTIMENT_LABELS,
  TOPIC_LABELS,
  type IntentLabel,
  type LanguageCode,
  type RelevanceLabel,
  type SafetyLevel,
  type SentimentLabel,
  type TopicLabel,
} from "@how-about-me/taxonomy";
import type { ContentClassifier, SafetyProvider, Usage } from "../../modules/analysis/providers/interfaces";
import { toSafetyAnalysis } from "../../modules/analysis/safety/safety-mapping";
import type { EvalItem } from "./dataset";
import {
  type MultiLabelMetrics,
  type SafetyMetrics,
  type SingleLabelMetrics,
  multiLabelMetrics,
  percentile,
  ratio,
  safetyMetrics,
  singleLabelMetrics,
} from "./metrics";

export type Prediction = {
  relevance: RelevanceLabel;
  sentiment: SentimentLabel;
  intents: IntentLabel[];
  topics: TopicLabel[];
  language: LanguageCode;
  safetyLevel: SafetyLevel;
};

export type ItemResult = {
  item: EvalItem;
  prediction: Prediction | null;
  error: string | null;
  usage: Usage;
  latencyMs: number;
};

export type RunOptions = {
  classifier: ContentClassifier;
  safety: SafetyProvider;
  brandContext: string;
  concurrency: number;
  runId?: string;
};

const ZERO_USAGE: Usage = { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 };

/** Runs safety + classifier per item. A provider error on one item is recorded, never aborts the run. */
export async function runEval(items: readonly EvalItem[], opts: RunOptions): Promise<ItemResult[]> {
  const runId = opts.runId ?? randomUUID();
  const results: ItemResult[] = new Array<ItemResult>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      const item = items[i];
      if (item) results[i] = await evaluateOne(item, opts, runId);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(opts.concurrency, items.length)) }, worker));
  return results;
}

async function evaluateOne(item: EvalItem, opts: RunOptions, runId: string): Promise<ItemResult> {
  const ctx = { requestId: randomUUID(), projectId: "eval", runId };
  const started = performance.now();
  try {
    const safetyRaw = await opts.safety.moderate({ text: item.text }, ctx);
    const { safetyLevel } = toSafetyAnalysis(safetyRaw);
    const { usage, ...out } = await opts.classifier.classify(
      { text: item.text, matchedTerms: item.matchedTerms, brandContext: opts.brandContext },
      ctx,
    );
    return {
      item,
      prediction: {
        relevance: out.relevance.label,
        sentiment: out.sentiment.label,
        intents: out.intents.map((x) => x.label),
        topics: out.topics.map((x) => x.label),
        language: out.language,
        safetyLevel,
      },
      error: null,
      usage,
      latencyMs: performance.now() - started,
    };
  } catch (err: unknown) {
    // Message only — never the item text (PII).
    const message = err instanceof Error ? err.message : String(err);
    return { item, prediction: null, error: message, usage: ZERO_USAGE, latencyMs: performance.now() - started };
  }
}

export type EvalSummary = {
  n: number;
  errors: { id: string; message: string }[];
  relevance: SingleLabelMetrics & { irrelevantRecall: number | null };
  sentiment: SingleLabelMetrics & { viAccuracy: number | null; viN: number };
  intents: MultiLabelMetrics;
  topics: MultiLabelMetrics;
  safety: SafetyMetrics;
  usage: {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCostUsd: number;
    avgTokensPerItem: number | null;
    avgCostPerItem: number | null;
  };
  latency: { p50: number | null; p95: number | null };
  mismatches: { id: string; dimension: string; gold: string; pred: string }[];
};

/** Aggregates per-dimension metrics. Items whose gold lacks a dimension are excluded from that dimension. */
export function summarize(results: readonly ItemResult[]): EvalSummary {
  const ok = results.filter((r): r is ItemResult & { prediction: Prediction } => r.prediction !== null);
  const mismatches: EvalSummary["mismatches"] = [];
  const note = (id: string, dimension: string, gold: string, pred: string) => {
    if (gold !== pred) mismatches.push({ id, dimension, gold, pred });
  };

  const relPairs = ok.map((r) => ({ gold: r.item.labels.relevance, pred: r.prediction.relevance }));
  ok.forEach((r) => note(r.item.id, "relevance", r.item.labels.relevance, r.prediction.relevance));

  const sentItems = ok.filter((r) => r.item.labels.sentiment !== undefined);
  const sentPairs = sentItems.map((r) => ({ gold: r.item.labels.sentiment ?? "", pred: r.prediction.sentiment }));
  sentItems.forEach((r) => note(r.item.id, "sentiment", r.item.labels.sentiment ?? "", r.prediction.sentiment));
  // VI subset by gold language (doc 08 §11 "on VI set").
  const viPairs = sentItems.filter((r) => r.item.labels.language === "vi");
  const viCorrect = viPairs.filter((r) => r.item.labels.sentiment === r.prediction.sentiment).length;

  const multi = (key: "intents" | "topics") => {
    const xs = ok.filter((r) => r.item.labels[key] !== undefined);
    xs.forEach((r) =>
      note(r.item.id, key, [...(r.item.labels[key] ?? [])].sort().join(","), [...r.prediction[key]].sort().join(",")),
    );
    return xs.map((r) => ({ gold: r.item.labels[key] ?? [], pred: r.prediction[key] }));
  };
  const intentPairs = multi("intents");
  const topicPairs = multi("topics");

  const safetyPairs = ok.map((r) => ({
    id: r.item.id,
    gold: r.item.labels.safetyLevel,
    pred: r.prediction.safetyLevel,
  }));
  ok.forEach((r) => note(r.item.id, "safetyLevel", r.item.labels.safetyLevel, r.prediction.safetyLevel));

  const relevance = singleLabelMetrics(relPairs, RELEVANCE_LABELS);
  const totalIn = results.reduce((a, r) => a + r.usage.inputTokens, 0);
  const totalOut = results.reduce((a, r) => a + r.usage.outputTokens, 0);
  const totalCost = results.reduce((a, r) => a + r.usage.estimatedCostUsd, 0);
  const latencies = results.map((r) => r.latencyMs);

  return {
    n: results.length,
    errors: results.filter((r) => r.error !== null).map((r) => ({ id: r.item.id, message: r.error ?? "" })),
    relevance: {
      ...relevance,
      irrelevantRecall: relevance.perLabel.find((s) => s.label === "irrelevant")?.recall ?? null,
    },
    sentiment: {
      ...singleLabelMetrics(sentPairs, SENTIMENT_LABELS),
      viAccuracy: ratio(viCorrect, viPairs.length),
      viN: viPairs.length,
    },
    intents: multiLabelMetrics(intentPairs, INTENT_LABELS),
    topics: multiLabelMetrics(topicPairs, TOPIC_LABELS),
    safety: safetyMetrics(safetyPairs, SAFETY_LEVELS),
    usage: {
      totalInputTokens: totalIn,
      totalOutputTokens: totalOut,
      totalCostUsd: totalCost,
      avgTokensPerItem: ratio(totalIn + totalOut, ok.length),
      avgCostPerItem: ratio(totalCost, ok.length),
    },
    latency: { p50: percentile(latencies, 50), p95: percentile(latencies, 95) },
    mismatches,
  };
}
