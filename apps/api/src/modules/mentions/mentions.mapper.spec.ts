import { MentionDetailSchema, MentionListItemSchema } from "@how-about-me/contracts";
import { toMentionDetail, toMentionListItem } from "./mentions.mapper";
import type { HydratedMentions, MentionDetailRow, MentionPageRow, MentionRunRow } from "./mentions.repository";

const POST = "11111111-1111-4111-8111-111111111111";
const AID = "22222222-2222-4222-8222-222222222222";
const base: MentionPageRow = {
  post_id: POST,
  platform: "threads",
  platform_post_id: "tp-1",
  username: "u",
  permalink: null,
  published_at: new Date("2026-10-01T03:00:00Z"),
  text: "hello",
  media_type: null,
  thumbnail_url: null,
  has_replies: null,
  is_quote_post: null,
  latest_run_status: "completed",
  analysis_id: AID,
  relevance_label: "relevant",
  relevance_confidence: 0.9,
  sentiment_label: "negative",
  sentiment_confidence: 0.8,
  safety_level: "safe",
  language_code: "vi",
  summary: null,
  overall_model_confidence: 0.8,
  has_override: false,
  keys: [],
};
const empty: HydratedMentions = { matches: new Map(), intents: new Map(), topics: new Map(), errorCodes: new Map() };
const map = (over: Partial<MentionPageRow>, h: HydratedMentions = empty) => toMentionListItem({ ...base, ...over }, h);

/** T-095 projection — FR-150, FR-156, BR-017, BR-020, BR-021, BR-025. */
describe("toMentionListItem", () => {
  it("produces a contract-valid item with UTC Z timestamp", () => {
    const item = map({});
    expect(MentionListItemSchema.parse(item)).toBeTruthy();
    expect(item.publishedAt).toBe("2026-10-01T03:00:00.000Z");
  });

  it("no run yet → status pending, labels null", () => {
    const a = map({
      latest_run_status: null,
      analysis_id: null,
      relevance_label: null,
      sentiment_label: null,
      safety_level: null,
      overall_model_confidence: null,
    }).analysis;
    expect(a.status).toBe("pending");
    expect(a.relevance).toBeNull();
    expect(a.sentiment).toBeNull();
    expect(a.safety).toBeNull();
    expect(a.confidenceBand).toBeNull();
  });

  it("source: ai / mixed / analyst (BR-025)", () => {
    expect(map({}).analysis.source).toBe("ai");
    expect(map({ has_override: true }).analysis.source).toBe("mixed");
    expect(map({ has_override: true, analysis_id: null }).analysis.source).toBe("analyst");
  });

  it.each([
    [0.8, "high"],
    [0.79, "medium"],
    [0.59, "low"],
  ])("BR-021: overall %p → band %p", (c, band) => {
    expect(map({ overall_model_confidence: c }).analysis.confidenceBand).toBe(band);
  });

  it("FR-156: errorCode only when failed", () => {
    const h = { ...empty, errorCodes: new Map([[POST, "OPENAI_TIMEOUT"]]) };
    expect(map({ latest_run_status: "failed" }, h).analysis.errorCode).toBe("OPENAI_TIMEOUT");
    expect(map({}, h).analysis).not.toHaveProperty("errorCode");
  });

  it("BR-017: negative sentiment and safe safety are independent", () => {
    const a = map({}).analysis;
    expect(a.sentiment?.label).toBe("negative");
    expect(a.safety).toEqual({ level: "safe" });
  });

  it("unknown language code → null; intents/topics come from hydrate", () => {
    const h = { ...empty, intents: new Map([[AID, [{ label: "complaint", confidence: 0.7 }]]]) };
    const a = map({ language_code: "xx" }, h).analysis;
    expect(a.language).toBeNull();
    expect(a.intents).toEqual([{ label: "complaint", confidence: 0.7 }]);
  });
});

const detailBase: MentionDetailRow = {
  ...base,
  owner_id: "o1",
  shortcode: "sc",
  media_url: null,
  alt_text: null,
  link_attachment_url: null,
  quoted_post_id: null,
  reposted_post_id: null,
  first_seen_at: new Date("2026-10-01T03:05:00Z"),
  last_seen_at: new Date("2026-10-01T04:00:00Z"),
  revision: 2,
  content_hash: "h",
  relevance_explanation: "why",
  safety_category_scores: { harassment: 0.6, "self-harm/intent": 0.5, hate: 0.1 },
  safety_flagged: false,
  classifier_provider: "openai",
  classifier_model: "m",
  prompt_version: "p1",
  taxonomy_version: "t1",
  safety_provider: "openai",
  safety_model: "mod",
  safety_policy_version: "safety-policy-v1",
  input_tokens: 10,
  output_tokens: 5,
  estimated_cost_usd: 0.0012,
  analyzed_at: new Date("2026-10-01T03:10:00Z"),
};
const run: MentionRunRow = {
  id: "33333333-3333-4333-8333-333333333333",
  status: "completed",
  trigger: "ingest",
  effectiveVersion: "v1",
  createdAt: new Date("2026-10-01T03:09:00Z"),
  completedAt: new Date("2026-10-01T03:10:00Z"),
  errorCode: null,
  estimatedCostUsd: 0.0012,
};
const detail = (over: Partial<MentionDetailRow>, runs: MentionRunRow[] = [run]) =>
  toMentionDetail({ ...detailBase, ...over }, empty, runs);

/** T-096 projection — FR-154, BR-003, BR-017, BR-025; TC-MEN-010/011/012. */
describe("toMentionDetail", () => {
  it("TC-MEN-011/012: contract-valid with versions, tokens, cost and runs", () => {
    const d = MentionDetailSchema.parse(detail({}));
    expect(d.analysis.versions?.safetyPolicyVersion).toBe("safety-policy-v1");
    expect(d.analysis.analyzedAt).toBe("2026-10-01T03:10:00.000Z");
    expect(d.analysis.tokens).toEqual({ input: 10, output: 5 });
    expect(d.analysis.estimatedCostUsd).toBe(0.0012);
    expect(d.runs[0]).toMatchObject({
      status: "completed",
      completedAt: "2026-10-01T03:10:00.000Z",
      estimatedCostUsd: 0.0012,
    });
    expect(d.firstSeenAt).toBe("2026-10-01T03:05:00.000Z");
  });

  it("TC-MEN-010 / BR-017: triggered categories from policy v1, independent of sentiment", () => {
    const d = detail({});
    expect(d.analysis.safetyTriggered).toEqual([
      { category: "harassment", score: 0.6, level: "sensitive" },
      { category: "self-harm/intent", score: 0.5, level: "severe" },
    ]);
    expect(d.analysis.sentiment?.label).toBe("negative");
  });

  it("invalid scores JSON → scores and triggered null", () => {
    const d = detail({ safety_category_scores: { harassment: "high" } });
    expect(d.analysis.safetyCategoryScores).toBeNull();
    expect(d.analysis.safetyTriggered).toBeNull();
  });

  it("unanalysed post → analysis details null, runs []", () => {
    const d = detail(
      {
        analysis_id: null,
        latest_run_status: null,
        relevance_label: null,
        sentiment_label: null,
        safety_level: null,
        overall_model_confidence: null,
        relevance_explanation: null,
        safety_category_scores: null,
        classifier_provider: null,
        input_tokens: null,
        output_tokens: null,
        estimated_cost_usd: null,
        analyzed_at: null,
      },
      [],
    );
    expect(MentionDetailSchema.parse(d).analysis).toMatchObject({
      status: "pending",
      versions: null,
      tokens: null,
      analyzedAt: null,
      estimatedCostUsd: null,
      safetyCategoryScores: null,
      safetyTriggered: null,
    });
    expect(d.runs).toEqual([]);
  });

  it("BR-025: override → source mixed, explanation kept from AI analysis", () => {
    const d = detail({ has_override: true });
    expect(d.analysis.source).toBe("mixed");
    expect(d.analysis.hasOverride).toBe(true);
    expect(d.analysis.relevanceExplanation).toBe("why");
  });
});
