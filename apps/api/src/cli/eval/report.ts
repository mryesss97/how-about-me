import { SAFETY_POLICY_VERSION, TAXONOMY_VERSION } from "@how-about-me/taxonomy";
import type { LabelStats, MultiLabelMetrics, SingleLabelMetrics } from "./metrics";
import type { EvalSummary } from "./runner";
import { EVAL_TARGETS } from "./targets";

export type ReportMeta = {
  generatedAt: Date;
  datasetPath: string;
  datasetSha256: string;
  providersMode: "fake" | "real";
  classifier: { provider: string; model: string; promptVersion: string };
  safety: { name: string; model: string };
  brandContextSha256: string;
  brandContextLength: number;
  pricesConfigured: boolean;
};

export type GateRow = { metric: string; value: string; target: string; pass: boolean };

const fmt = (v: number | null, digits = 3) => (v === null ? "—" : v.toFixed(digits));

/** Freeze-gate rows (doc 08 §11). A null metric (no data) counts as FAIL. */
export function gateRows(s: EvalSummary): GateRow[] {
  const ge = (metric: string, v: number | null, target: number): GateRow => ({
    metric,
    value: fmt(v),
    target: `≥ ${target}`,
    pass: v !== null && v >= target,
  });
  return [
    ge("Relevance accuracy", s.relevance.accuracy, EVAL_TARGETS.relevanceAccuracy),
    ge("Relevance `irrelevant` recall", s.relevance.irrelevantRecall, EVAL_TARGETS.irrelevantRecall),
    ge("Sentiment accuracy (VI)", s.sentiment.viAccuracy, EVAL_TARGETS.sentimentAccuracyVi),
    ge("Intent micro-F1", s.intents.microF1, EVAL_TARGETS.intentMicroF1),
    ge("Topic micro-F1", s.topics.microF1, EVAL_TARGETS.topicMicroF1),
    ge("Safety agreement", s.safety.agreement, EVAL_TARGETS.safetyAgreement),
    {
      metric: "Severe false negatives (BR-018)",
      value: `${s.safety.severeFalseNegatives.length} / ${s.safety.severeSubsetN}`,
      target: `= ${EVAL_TARGETS.severeFalseNegatives}`,
      pass: s.safety.severeSubsetN > 0 && s.safety.severeFalseNegatives.length === EVAL_TARGETS.severeFalseNegatives,
    },
  ];
}

/** Markdown report. Contains item ids and labels only — never item text (PII). */
export function renderReport(s: EvalSummary, meta: ReportMeta): string {
  const out: string[] = [];
  const gates = gateRows(s);
  out.push(`# Classifier evaluation — ${meta.classifier.promptVersion}`, "");
  if (meta.providersMode === "fake")
    out.push("> ⚠️ **Fake providers — không phải kết quả freeze.** Chỉ chứng minh pipeline đánh giá chạy được.", "");
  out.push(
    `- Generated (UTC): ${meta.generatedAt.toISOString()}`,
    `- Dataset: \`${meta.datasetPath}\` (sha256 \`${meta.datasetSha256}\`), ${s.n} item(s), ${s.errors.length} error(s)`,
    `- Providers mode: \`${meta.providersMode}\``,
    `- Classifier: \`${meta.classifier.provider}\` / \`${meta.classifier.model}\`, prompt \`${meta.classifier.promptVersion}\``,
    `- Safety: \`${meta.safety.name}\` / \`${meta.safety.model}\``,
    `- Taxonomy \`${TAXONOMY_VERSION}\`, safety policy \`${SAFETY_POLICY_VERSION}\``,
    `- Brand context: sha256 \`${meta.brandContextSha256.slice(0, 12)}\`, ${meta.brandContextLength} chars`,
    "",
    "## Freeze gate (doc 08 §11)",
    "",
    "| Metric | Value | Target | Result |",
    "| --- | --- | --- | --- |",
    ...gates.map((g) => `| ${g.metric} | ${g.value} | ${g.target} | ${g.pass ? "PASS" : "FAIL"} |`),
    "",
    `Overall: **${gates.every((g) => g.pass) ? "PASS" : "FAIL"}**`,
    "",
  );

  out.push(...single("Relevance", s.relevance));
  out.push(
    ...single(`Sentiment (VI subset n=${s.sentiment.viN}, accuracy ${fmt(s.sentiment.viAccuracy)})`, s.sentiment),
  );
  out.push(...multi("Intents", s.intents), ...multi("Topics", s.topics));
  out.push(...single(`Safety level (agreement ${fmt(s.safety.agreement)})`, s.safety));
  out.push(
    `Severe subset n=${s.safety.severeSubsetN}; false negatives: ${s.safety.severeFalseNegatives.length === 0 ? "none" : s.safety.severeFalseNegatives.map((id) => `\`${id}\``).join(", ")}`,
    "",
  );

  out.push(
    "## Usage & latency",
    "",
    `- Tokens: ${s.usage.totalInputTokens} in / ${s.usage.totalOutputTokens} out; avg ${fmt(s.usage.avgTokensPerItem, 1)} per item`,
    `- Cost (USD): total ${s.usage.totalCostUsd.toFixed(6)}, avg ${fmt(s.usage.avgCostPerItem, 6)} per item${meta.pricesConfigured ? "" : " (giá chưa cấu hình — `ANALYSIS_PRICE_*` = 0)"}`,
    `- Latency per item (ms): p50 ${fmt(s.latency.p50, 1)}, p95 ${fmt(s.latency.p95, 1)}`,
    "",
  );

  if (s.errors.length > 0) {
    out.push("## Errors", "", ...s.errors.map((e) => `- \`${e.id}\`: ${e.message}`), "");
  }
  out.push("## Mismatches", "");
  if (s.mismatches.length === 0) out.push("None.", "");
  else
    out.push(
      "| Id | Dimension | Gold | Pred |",
      "| --- | --- | --- | --- |",
      ...s.mismatches.map((m) => `| \`${m.id}\` | ${m.dimension} | ${m.gold} | ${m.pred} |`),
      "",
    );
  return out.join("\n");
}

function statsTable(rows: readonly LabelStats[]): string[] {
  return [
    "| Label | Precision | Recall | F1 | Support |",
    "| --- | --- | --- | --- | --- |",
    ...rows.map((r) => `| ${r.label} | ${fmt(r.precision)} | ${fmt(r.recall)} | ${fmt(r.f1)} | ${r.support} |`),
  ];
}

function single(title: string, m: SingleLabelMetrics): string[] {
  const labels = Object.keys(m.confusion);
  return [
    `## ${title}`,
    "",
    `n=${m.n}, accuracy ${fmt(m.accuracy)}, macro-F1 ${fmt(m.macroF1)}`,
    "",
    ...statsTable(m.perLabel),
    "",
    "Confusion (rows = gold, columns = pred):",
    "",
    `| gold \\ pred | ${labels.join(" | ")} |`,
    `| --- | ${labels.map(() => "---").join(" | ")} |`,
    ...labels.map((g) => `| ${g} | ${labels.map((p) => m.confusion[g]?.[p] ?? 0).join(" | ")} |`),
    "",
  ];
}

function multi(title: string, m: MultiLabelMetrics): string[] {
  return [
    `## ${title}`,
    "",
    `n=${m.n}, micro-P ${fmt(m.microPrecision)}, micro-R ${fmt(m.microRecall)}, micro-F1 ${fmt(m.microF1)}, macro-F1 ${fmt(m.macroF1)}, exact match ${fmt(m.exactMatch)}`,
    "",
    ...statsTable(m.perLabel.filter((r) => r.support > 0 || r.precision !== null)),
    "",
  ];
}
