import type { MentionListItem } from "@how-about-me/contracts";
import { exportFilename, mentionsCsvHeader, toMentionsCsvRow } from "./mentions-csv";

const base: MentionListItem = {
  id: "00000000-0000-7000-8000-000000000001",
  platform: "threads",
  platformPostId: "1789",
  username: "alice",
  permalink: "https://threads.net/p/1",
  publishedAt: "2026-10-02T00:00:00.000Z",
  text: "hello",
  mediaType: null,
  thumbnailUrl: null,
  hasReplies: null,
  isQuotePost: null,
  matchedQueries: [
    { id: "q1", displayName: "Brand", queryType: "keyword", excludedByTerms: false },
    { id: "q2", displayName: "Excluded", queryType: "keyword", excludedByTerms: true },
    { id: "q3", displayName: "Other", queryType: "keyword", excludedByTerms: false },
  ],
  analysis: {
    status: "completed",
    source: "ai",
    relevance: { label: "relevant", confidence: 0.9 },
    sentiment: { label: "negative", confidence: 0.8 },
    safety: { level: "safe" },
    intents: [
      { label: "complaint", confidence: 0.7 },
      { label: "question", confidence: 0.5 },
    ],
    topics: [{ label: "price", confidence: 0.6 }],
    language: "vi",
    summary: "s",
    overallConfidence: 0.8,
    confidenceBand: "high",
    hasOverride: false,
  },
} as MentionListItem;

describe("mentions CSV mapping (FR-180)", () => {
  it("header has the agreed column order", () => {
    expect(mentionsCsvHeader()).toBe(
      "post_id,platform_post_id,permalink,username,text,published_at,matched_queries,relevance,sentiment,safety,intents,topics,language,summary,analyzed_at\r\n",
    );
  });

  it("maps a full item; BR-007 only non-excluded matches; multi-values joined with '; '; UTC ISO", () => {
    const row = toMentionsCsvRow(base, new Date("2026-10-02T01:00:00Z"));
    expect(row).toBe(
      `${base.id},1789,https://threads.net/p/1,alice,hello,2026-10-02T00:00:00.000Z,Brand; Other,relevant,negative,safe,complaint; question,price,vi,s,2026-10-02T01:00:00.000Z\r\n`,
    );
  });

  it("unanalysed item → empty label cells", () => {
    const item = {
      ...base,
      matchedQueries: [],
      analysis: {
        ...base.analysis,
        status: "pending",
        relevance: null,
        sentiment: null,
        safety: null,
        intents: [],
        topics: [],
        language: null,
        summary: null,
      },
    } as MentionListItem;
    expect(toMentionsCsvRow(item, null)).toBe(
      `${base.id},1789,https://threads.net/p/1,alice,hello,2026-10-02T00:00:00.000Z,,,,,,,,,\r\n`,
    );
  });

  it("guards formulas in free text", () => {
    expect(toMentionsCsvRow({ ...base, text: "=HYPERLINK()" }, null)).toContain(",'=HYPERLINK(),");
  });

  it("filename uses the request timezone", () => {
    expect(exportFilename(new Date("2026-10-13T17:30:00Z"))).toBe("mentions-20261014-0030.csv");
    expect(exportFilename(new Date("2026-10-13T17:30:00Z"), "UTC")).toBe("mentions-20261013-1730.csv");
  });
});
