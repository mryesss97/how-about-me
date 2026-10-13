import { z } from "zod";
import {
  ClassifierOutputJsonSchema,
  ClassifierOutputSchema,
  parseClassifierOutput,
  type ClassifierOutput,
} from "@how-about-me/contracts";
import { DEFAULT_PROMPT_VERSION, effectiveRelevance } from "@how-about-me/taxonomy";
import { ProviderError } from "../../../common/errors/provider.error";
import { withRetry, type RetryPolicy } from "../../../common/retry";
import { loadPrompt, renderMessages, type ClassifierPrompt } from "../prompts/prompt-loader";
import { ADAPTER_RETRY } from "./adapter-retry";
import { estimateCostUsd } from "./deterministic";
import type { AnalysisContext, ClassifierInput, ContentClassifier, Usage } from "./interfaces";
import { postOpenAiJson, type FetchFn } from "./openai-http";

/**
 * Real classifier over OpenAI `/chat/completions` with strict JSON-schema structured outputs, temperature 0
 * (T-072; FR-106..110, FR-112, FR-117) — docs/02-architecture/07-analysis-pipeline.md §3–§5.
 *
 * - Prompt text is read from the versioned `prompts/classifier-v1.md`; `promptVersion` is persisted (BR-023).
 * - Sentiment only; safety is a separate provider and is never inferred here (BR-017).
 * - Low-confidence relevance (< 0.60) is stored as `uncertain` via `effectiveRelevance` (BR-021, doc 08 §8).
 * - Invalid output → `ANALYSIS_SCHEMA_INVALID` with Zod path/message only, never post text. The corrective
 *   retry (FR-113) lives in `AnalysisPipelineService`; issues are also exposed as `details.issues`.
 * - Nothing is logged; the request body and model content never reach errors.
 */
export type OpenAiClassifierOptions = {
  apiKey: string;
  model: string;
  baseUrl: string;
  timeoutMs: number;
  maxRetries: number;
  prices: { inputPer1M: number; outputPer1M: number };
  skipSummaryForSpam: boolean;
  promptVersion?: string;
  fetchFn?: FetchFn;
  retry?: Partial<RetryPolicy>;
};

const ChatResponseSchema = z.object({
  id: z.string().optional(),
  model: z.string().optional(),
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().nullable().optional(), refusal: z.string().nullable().optional() }),
        finish_reason: z.string().nullable().optional(),
      }),
    )
    .min(1),
  usage: z.object({ prompt_tokens: z.number(), completion_tokens: z.number() }).optional(),
});

const RelevanceOutputSchema = ClassifierOutputSchema.pick({ relevance: true, language: true });

/** Keywords OpenAI strict mode may reject; the same limits are enforced by Zod after the response. */
const UNSUPPORTED_KEYWORDS = new Set([
  "$schema",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "pattern",
  "format",
]);

/** Strips unsupported keywords and forces `additionalProperties:false` + full `required` on every object. */
export function toOpenAiStrictSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toOpenAiStrictSchema);
  if (schema === null || typeof schema !== "object") return schema;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema)) {
    if (UNSUPPORTED_KEYWORDS.has(k)) continue;
    out[k] =
      k === "properties" && v && typeof v === "object"
        ? Object.fromEntries(Object.entries(v).map(([pk, pv]) => [pk, toOpenAiStrictSchema(pv)]))
        : toOpenAiStrictSchema(v);
  }
  if (out.type === "object" && out.properties && typeof out.properties === "object") {
    out.additionalProperties = false;
    out.required = Object.keys(out.properties);
  }
  return out;
}

const FULL_SCHEMA = toOpenAiStrictSchema(ClassifierOutputJsonSchema);
const RELEVANCE_SCHEMA = toOpenAiStrictSchema(z.toJSONSchema(RelevanceOutputSchema, { target: "draft-2020-12" }));

/**
 * Defensive output for empty text (T-074 already skips `empty_text`, doc 07 §2). Not a model call, so it is
 * returned as is (no BR-021 banding): nothing to classify is a certain `irrelevant`.
 */
const EMPTY_OUTPUT: ClassifierOutput = {
  relevance: { label: "irrelevant", confidence: 0, explanation: "" },
  sentiment: { label: "neutral", confidence: 0 },
  intents: [{ label: "other", confidence: 0 }],
  topics: [{ label: "other", confidence: 0 }],
  language: "unknown",
  summary: "",
};
const ZERO_USAGE: Usage = { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 };

export class OpenAiStructuredClassifier implements ContentClassifier {
  readonly provider = "openai";
  readonly model: string;
  readonly promptVersion: string;
  private readonly prompt: ClassifierPrompt;

  constructor(private readonly opts: OpenAiClassifierOptions) {
    this.model = opts.model;
    this.promptVersion = opts.promptVersion ?? DEFAULT_PROMPT_VERSION;
    // Fail fast at boot if the prompt file is missing or its few-shot outputs are invalid.
    this.prompt = loadPrompt(this.promptVersion);
  }

  /** Cheap relevance gate for `ANALYSIS_TWO_STEP` (doc 07 §2): only `{ relevance, language }`. */
  async relevance(input: ClassifierInput, _ctx: AnalysisContext) {
    if (input.text.trim() === "")
      return { relevance: EMPTY_OUTPUT.relevance, language: EMPTY_OUTPUT.language, usage: ZERO_USAGE };
    const { content, usage } = await this.complete(input, "relevance_v1", RELEVANCE_SCHEMA);
    const parsed = RelevanceOutputSchema.safeParse(content);
    if (!parsed.success) throw schemaInvalid(parsed.error.issues);
    return {
      relevance: banded({ ...parsed.data.relevance, explanation: parsed.data.relevance.explanation.trim() }),
      language: parsed.data.language,
      usage,
    };
  }

  async classify(input: ClassifierInput, _ctx: AnalysisContext): Promise<ClassifierOutput & { usage: Usage }> {
    if (input.text.trim() === "") return { ...EMPTY_OUTPUT, usage: ZERO_USAGE };
    const { content, usage } = await this.complete(input, "classifier_output_v1", FULL_SCHEMA);
    const parsed = parseClassifierOutput(content);
    if (!parsed.ok)
      throw new ProviderError("ANALYSIS_SCHEMA_INVALID", `Classifier output invalid: ${parsed.issues.join("; ")}`, {
        details: { issues: parsed.issues },
      });
    const out = { ...parsed.value, relevance: banded(parsed.value.relevance) };
    // FR-110: no summary for irrelevant posts, nor for spam when configured.
    const dropSummary =
      out.relevance.label === "irrelevant" ||
      (this.opts.skipSummaryForSpam && out.intents.some((i) => i.label === "spam"));
    return { ...out, summary: dropSummary ? "" : out.summary, usage };
  }

  private async complete(input: ClassifierInput, name: string, schema: unknown) {
    const url = `${this.opts.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    const request = {
      model: this.model,
      temperature: 0,
      messages: renderMessages(this.prompt, input),
      response_format: { type: "json_schema", json_schema: { name, strict: true, schema } },
    };
    const body = await withRetry(
      () =>
        postOpenAiJson(url, request, {
          apiKey: this.opts.apiKey,
          timeoutMs: this.opts.timeoutMs,
          ...(this.opts.fetchFn ? { fetchFn: this.opts.fetchFn } : {}),
        }),
      { ...ADAPTER_RETRY, ...this.opts.retry, maxRetries: this.opts.maxRetries },
    );

    const res = ChatResponseSchema.safeParse(body);
    if (!res.success) throw new ProviderError("ANALYSIS_SCHEMA_INVALID", "OpenAI chat response shape invalid");
    const choice = res.data.choices[0];
    if (!choice) throw new ProviderError("ANALYSIS_SCHEMA_INVALID", "OpenAI returned no choices");
    if (choice.message.refusal) throw new ProviderError("ANALYSIS_SCHEMA_INVALID", "Classifier refused the request");
    if (choice.finish_reason === "length")
      throw new ProviderError("ANALYSIS_SCHEMA_INVALID", "Classifier output truncated (finish_reason=length)");
    if (!choice.message.content) throw new ProviderError("ANALYSIS_SCHEMA_INVALID", "Classifier returned no content");

    let content: unknown;
    try {
      content = JSON.parse(choice.message.content) as unknown;
    } catch {
      throw new ProviderError("ANALYSIS_SCHEMA_INVALID", "Classifier content is not valid JSON");
    }
    // FR-117: tokens + estimated cost; missing usage is recorded as zero rather than failing the run.
    const inputTokens = res.data.usage?.prompt_tokens ?? 0;
    const outputTokens = res.data.usage?.completion_tokens ?? 0;
    const usage: Usage = {
      inputTokens,
      outputTokens,
      estimatedCostUsd: estimateCostUsd(inputTokens, outputTokens, this.opts.prices),
    };
    return { content, usage };
  }
}

/** BR-021: a low-confidence relevance call is treated as `uncertain` before it is persisted. */
function banded(relevance: ClassifierOutput["relevance"]): ClassifierOutput["relevance"] {
  return { ...relevance, label: effectiveRelevance(relevance.label, relevance.confidence) };
}

function schemaInvalid(issues: z.core.$ZodIssue[]): ProviderError {
  const lines = issues.slice(0, 10).map((i) => `${i.path.map(String).join(".") || "(root)"}: ${i.message}`);
  return new ProviderError("ANALYSIS_SCHEMA_INVALID", `Classifier output invalid: ${lines.join("; ")}`, {
    details: { issues: lines },
  });
}
