import { z } from "zod";
import { ProviderError } from "../../../common/errors/provider.error";
import { withRetry, type RetryPolicy } from "../../../common/retry";
import { ADAPTER_RETRY } from "./adapter-retry";
import type { AnalysisContext, SafetyProvider, SafetyProviderResult } from "./interfaces";
import { postOpenAiJson, type FetchFn } from "./openai-http";

/**
 * Real moderation adapter over OpenAI `/v1/moderations` (T-071, FR-104, FR-112) —
 * docs/02-architecture/07-analysis-pipeline.md §3/§6/§8.
 *
 * Only the post text is sent. Retries transient failures (`ANALYSIS_PROVIDER_ERROR`) up to `maxRetries`
 * times inside one job attempt; this is in addition to the job-level backoff (`analysis-failure-policy.ts`).
 */
export type OpenAiModerationOptions = {
  apiKey: string;
  model: string;
  baseUrl: string;
  timeoutMs: number;
  maxRetries: number;
  fetchFn?: FetchFn;
  retry?: Partial<RetryPolicy>;
};

const ModerationResponseSchema = z.object({
  id: z.string().optional(),
  model: z.string().optional(),
  results: z
    .array(
      z.object({
        flagged: z.boolean(),
        categories: z.record(z.string(), z.boolean()),
        category_scores: z.record(z.string(), z.number()),
      }),
    )
    .min(1),
});

export class OpenAiModerationProvider implements SafetyProvider {
  readonly name = "openai";
  readonly model: string;

  constructor(private readonly opts: OpenAiModerationOptions) {
    this.model = opts.model;
  }

  async moderate(input: { text: string }, _ctx: AnalysisContext): Promise<SafetyProviderResult> {
    // Empty text: nothing to moderate; T-074 decides whether to skip the safety step entirely.
    if (input.text.trim() === "") return { flagged: false, categoryScores: {}, categories: {} };

    const url = `${this.opts.baseUrl.replace(/\/+$/, "")}/moderations`;
    const body = await withRetry(
      () =>
        postOpenAiJson(
          url,
          { model: this.model, input: input.text },
          {
            apiKey: this.opts.apiKey,
            timeoutMs: this.opts.timeoutMs,
            ...(this.opts.fetchFn ? { fetchFn: this.opts.fetchFn } : {}),
          },
        ),
      { ...ADAPTER_RETRY, ...this.opts.retry, maxRetries: this.opts.maxRetries },
    );

    const parsed = ModerationResponseSchema.safeParse(body);
    if (!parsed.success) throw new ProviderError("ANALYSIS_SCHEMA_INVALID", "OpenAI moderation response shape invalid");
    const [result] = parsed.data.results;
    // Unreachable after .min(1); kept to narrow the type under noUncheckedIndexedAccess.
    if (!result) throw new ProviderError("ANALYSIS_SCHEMA_INVALID", "OpenAI moderation returned no results");

    const categoryScores = Object.fromEntries(
      Object.entries(result.category_scores).map(([k, v]) => [k, Math.min(1, Math.max(0, v))]),
    );
    return {
      flagged: result.flagged,
      categoryScores,
      categories: result.categories,
      // Only ids for audit (actual model snapshot); never the text.
      raw: { id: parsed.data.id, model: parsed.data.model },
    };
  }
}
