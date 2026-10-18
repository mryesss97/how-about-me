import { encodeSortCursor } from "../../common/pagination/cursor";
import { BulkReanalyzeBodySchema, MENTION_SORTS, MentionsListQuerySchema } from "@how-about-me/contracts";
import {
  decodeMentionCursor,
  escapeLike,
  keysetPredicate,
  MENTION_SORT_SPECS,
  mentionsFromWhere,
  orderBy,
  resolveFilterScope,
  resolveMentionsScope,
  searchMode,
  sortKeySelect,
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

  it("BR-016 exception (#328): status-only filter keeps NULL-relevance posts on the mentions base set", () => {
    const { scope } = resolveMentionsScope(MentionsListQuerySchema.parse({ analysisStatus: "failed" }), PID, now);
    expect(norm(withMentionsBase(scope, mentionsFromWhere(undefined)))).toContain("OR e.relevance_label IS NULL");
  });

  it("resolveMentionsScope: default 7×24h range, relevance=relevant (BR-016), reviewStatus kept out of filters", () => {
    const r = resolveMentionsScope(MentionsListQuerySchema.parse({ reviewStatus: "reviewed" }), PID, now);
    expect(r.scope.range.to).toEqual(now);
    expect(r.scope.range.from).toEqual(new Date("2026-10-06T00:00:00Z"));
    expect(r.scope.filters.relevance).toEqual(["relevant"]);
    expect(r.scope.filters).not.toHaveProperty("reviewStatus");
    expect(r.scope.filters).not.toHaveProperty("q");
    expect(r).toMatchObject({ sort: "newest", limit: 25, count: false, reviewStatus: ["reviewed"] });
  });

  it("BR-040 (#115): reviewStatus filter — one value filters, none or both do not", () => {
    expect(norm(mentionsFromWhere(undefined, ["reviewed"]))).toMatch(/AND \(p\.reviewed_at IS NOT NULL/);
    expect(norm(mentionsFromWhere(undefined, ["unreviewed"]))).toMatch(/AND NOT \(p\.reviewed_at IS NOT NULL/);
    expect(norm(mentionsFromWhere(undefined, []))).not.toContain("reviewed_at");
    expect(norm(mentionsFromWhere(undefined, ["reviewed", "unreviewed"]))).not.toContain("reviewed_at");
  });

  it("T-145 resolveFilterScope: bulk body → same scope as list (default range, BR-016), no reviewStatus", () => {
    const { dryRun: _d, ...body } = BulkReanalyzeBodySchema.parse({ reviewStatus: "reviewed", dryRun: true });
    const r = resolveFilterScope(body, PID, now);
    expect(r.scope).toEqual(resolveMentionsScope(MentionsListQuerySchema.parse({}), PID, now).scope);
    expect(r.scope.filters).not.toHaveProperty("dryRun");
    expect(r.scope.filters).not.toHaveProperty("reviewStatus");
  });

  describe("#195 cursor key validation", () => {
    const T = "2026-10-01T00:00:00.123456Z";
    const dec = (sort: (typeof MENTION_SORTS)[number], keys: (string | number)[]) => () =>
      decodeMentionCursor(encodeSortCursor({ sort, keys, id: ID }), sort);

    it("sortKeySelect: to_char UTC µs for timestamptz, ::text for int/numeric", () => {
      const s = norm(sortKeySelect(MENTION_SORT_SPECS.relevance_desc));
      expect(s).toContain(`to_char((b.published_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS k2`);
      expect(s).toMatch(/END\)\)::text AS k0/);
      expect(s).toContain("(COALESCE(b.relevance_confidence, -1))::text AS k1");
    });

    it("no cursor → null", () => {
      expect(decodeMentionCursor(undefined, "newest")).toBeNull();
    });

    it("valid keys per sort pass and are normalised to strings", () => {
      expect(dec("newest", [T])()).toEqual({ sort: "newest", keys: [T], id: ID });
      expect(dec("oldest", [T])()?.keys).toEqual([T]);
      expect(dec("safety_desc", [3, T])()?.keys).toEqual(["3", T]);
      expect(dec("confidence_asc", ["0.5000", T])()?.keys).toEqual(["0.5000", T]);
      expect(dec("confidence_asc", [2, T])()?.keys).toEqual(["2", T]);
      expect(dec("relevance_desc", ["3", "-1", T])()?.keys).toEqual(["3", "-1", T]);
    });

    it.each<[(typeof MENTION_SORTS)[number], (string | number)[]]>([
      ["newest", ["abc"]],
      ["newest", [1700000000]],
      ["newest", ["2026-10-01 00:00:00.123456+00"]], // legacy pre-#195 format
      ["newest", ["2026-02-30T00:00:00.000000Z"]],
      ["oldest", ["t"]],
      ["safety_desc", ["x", T]],
      ["safety_desc", ["99999999999", T]],
      ["safety_desc", ["2147483648", T]],
      ["safety_desc", ["1.5", T]],
      ["safety_desc", [1.5, T]],
      ["confidence_asc", ["NaN", T]],
      ["confidence_asc", ["Infinity", T]],
      ["confidence_asc", ["1e400", T]],
      ["confidence_asc", ["", T]],
      ["relevance_desc", ["3", "abc", T]],
      ["relevance_desc", ["3", "0.5", "x"]],
    ])("%s with keys %j → VALIDATION_ERROR", (sort, keys) => {
      expect(dec(sort, keys)).toThrow(expect.objectContaining({ code: "VALIDATION_ERROR" }));
    });
  });
});
