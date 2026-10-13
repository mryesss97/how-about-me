import { MentionListItemSchema } from "@how-about-me/contracts";
import { toMentionListItem } from "./mentions.mapper";
import type { HydratedMentions, MentionPageRow } from "./mentions.repository";

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
