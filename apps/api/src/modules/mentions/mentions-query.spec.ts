import { MENTION_SORTS, MentionsListQuerySchema } from "@how-about-me/contracts";
import {
  escapeLike,
  keysetPredicate,
  MENTION_SORT_SPECS,
  mentionsFromWhere,
  orderBy,
  resolveMentionsScope,
  searchMode,
  textSearchPredicate,
  withMentionsBase,
} from "./mentions-query";

const PID = "11111111-1111-4111-8111-111111111111";
const ID = "22222222-2222-4222-8222-222222222222";
const norm = (s: { sql: string }) => s.sql.replace(/\s+/g, " ");
const now = new Date("2026-10-13T00:00:00Z");

/** T-095 — FR-152 (sort/keyset), FR-161 (search), BR-016/BR-028. */
describe("mentions-query", () => {
  it("TC-MEN-007: each sort has a deterministic ORDER BY ending with post_id", () => {
    expect(orderBy(MENTION_SORT_SPECS.newest).sql).toBe("ORDER BY b.published_at DESC, b.post_id DESC");
    expect(orderBy(MENTION_SORT_SPECS.oldest).sql).toBe("ORDER BY b.published_at ASC, b.post_id ASC");
    expect(orderBy(MENTION_SORT_SPECS.safety_desc).sql).toMatch(
      /^ORDER BY \(CASE b.safety_level .* DESC, b.published_at DESC, b.post_id DESC$/,
    );
    expect(orderBy(MENTION_SORT_SPECS.confidence_asc).sql).toBe(
      "ORDER BY COALESCE(b.overall_model_confidence, 2) ASC, b.published_at DESC, b.post_id DESC",
    );
    expect(orderBy(MENTION_SORT_SPECS.relevance_desc).sql).toContain(
      "COALESCE(b.relevance_confidence, -1) DESC, b.published_at DESC, b.post_id DESC",
    );
    expect(Object.keys(MENTION_SORT_SPECS).sort()).toEqual([...MENTION_SORTS].sort());
  });

  it("keyset: no cursor → empty", () => {
    expect(keysetPredicate(MENTION_SORT_SPECS.newest, null).sql).toBe("");
  });

  it("keyset DESC/ASC use < / > and bind every value", () => {
    const d = keysetPredicate(MENTION_SORT_SPECS.newest, { keys: ["2026-10-01 00:00:00.123456+00"], id: ID });
    expect(norm(d)).toBe(
      "AND ((b.published_at < ?::timestamptz) OR (b.published_at = ?::timestamptz AND b.post_id < ?::uuid))",
    );
    expect(d.values).toEqual(["2026-10-01 00:00:00.123456+00", "2026-10-01 00:00:00.123456+00", ID]);
    const a = keysetPredicate(MENTION_SORT_SPECS.oldest, { keys: ["t"], id: ID });
    expect(norm(a)).toContain("b.published_at > ?::timestamptz");
    expect(norm(a)).toContain("b.post_id > ?::uuid");
  });

  it("keyset mixed direction (confidence_asc): conf > then published_at <", () => {
    const k = keysetPredicate(MENTION_SORT_SPECS.confidence_asc, { keys: ["0.5000", "t"], id: ID });
    const s = norm(k);
    expect(s).toContain("(COALESCE(b.overall_model_confidence, 2) > ?::numeric)");
    expect(s).toContain("COALESCE(b.overall_model_confidence, 2) = ?::numeric AND b.published_at < ?::timestamptz");
    expect(s).toContain("b.post_id < ?::uuid");
    expect(k.values).not.toContain(undefined);
    expect(s).not.toContain("0.5000");
  });

  it("FR-161: searchMode picks FTS for words, ILIKE for short or symbol-only terms", () => {
    expect(searchMode("giá vé")).toBe("fts");
    expect(searchMode("vé")).toBe("ilike");
    expect(searchMode("!!!")).toBe("ilike");
  });

  it("q is NFC-normalised and whitespace-collapsed before binding", () => {
    const nfd = "giá   vé ";
    const p = textSearchPredicate(nfd);
    expect(norm(p)).toBe("AND p.search_vector @@ websearch_to_tsquery('simple', ?)");
    expect(p.values).toEqual(["giá vé".normalize("NFC")]);
    expect(textSearchPredicate("   ").sql).toBe("");
  });

  it("ILIKE escapes wildcards", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
    const p = textSearchPredicate("5%");
    expect(norm(p)).toContain("p.text ILIKE ? ESCAPE");
    expect(p.values).toEqual(["%5\\%%"]);
  });

  it("page/count start from the analytics base set (metric-defs §6)", () => {
    const { scope } = resolveMentionsScope(MentionsListQuerySchema.parse({}), PID, now);
    const s = norm(withMentionsBase(scope, mentionsFromWhere("giá vé")));
    expect(s).toContain("FROM effective_post_analysis e");
    expect(s).toContain("FROM base b JOIN social_posts p ON p.id = b.post_id");
    expect(s).not.toContain("JOIN post_query_matches");
  });

  it("resolveMentionsScope: default 7×24h range, relevance=relevant (BR-016), reviewStatus ignored", () => {
    const r = resolveMentionsScope(MentionsListQuerySchema.parse({ reviewStatus: "reviewed" }), PID, now);
    expect(r.scope.range.to).toEqual(now);
    expect(r.scope.range.from).toEqual(new Date("2026-10-06T00:00:00Z"));
    expect(r.scope.filters.relevance).toEqual(["relevant"]);
    expect(r.scope.filters).not.toHaveProperty("reviewStatus");
    expect(r.scope.filters).not.toHaveProperty("q");
    expect(r).toMatchObject({ sort: "newest", limit: 25, count: false });
  });
});
