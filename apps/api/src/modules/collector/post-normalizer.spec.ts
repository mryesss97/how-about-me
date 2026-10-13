import type { ProviderItem } from "../integrations/threads/social-discovery.provider";
import {
  buildRawData,
  computeContentHash,
  normalizeItem,
  normalizePage,
  parseProviderTimestamp,
  RAW_DATA_MAX_BYTES,
} from "./post-normalizer";

const item = (over: Partial<ProviderItem> = {}): ProviderItem => ({
  id: "17901234567890123",
  timestamp: "2026-09-15T10:00:00+0000",
  text: "Vé 1Zone mở bán chưa mọi người?",
  username: "fan_1zone",
  permalink: "https://www.threads.net/@fan_1zone/post/abc",
  shortcode: "abc",
  media_type: "TEXT_POST",
  has_replies: true,
  ...over,
});

const ok = (i: ProviderItem) => {
  const r = normalizeItem(i);
  if (!r.ok) throw new Error(`expected a valid item, got ${r.invalid.reason}`);
  return r.post;
};

describe("normalizeItem (FR-074, FR-075)", () => {
  it("maps provider fields to column shape", () => {
    const post = ok(item({ owner: { id: "999" }, quoted_post: { id: "555" }, reposted_post: "777" }));
    expect(post.platformPostId).toBe("17901234567890123");
    expect(post.username).toBe("fan_1zone");
    expect(post.ownerId).toBe("999");
    expect(post.quotedPostId).toBe("555");
    expect(post.repostedPostId).toBe("777");
    expect(post.hasReplies).toBe(true);
    expect(post.isQuotePost).toBeNull();
    expect(post.publishedAt.toISOString()).toBe("2026-09-15T10:00:00.000Z");
  });

  it("trims and NFC-normalises the text; a missing text becomes an empty string", () => {
    expect(ok(item({ text: "  xin chào  " })).text).toBe("xin chào");
    expect(ok(item({ text: undefined })).text).toBe("");
  });

  it("TC-COL-009: an item without a timestamp is invalid, not stored", () => {
    const r = normalizeItem(item({ timestamp: undefined }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.invalid).toEqual({ platformPostId: "17901234567890123", reason: "missing_timestamp" });
  });

  it("TC-COL-009: an unparseable timestamp and a missing id are invalid too", () => {
    const bad = normalizeItem(item({ timestamp: "yesterday" }));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.invalid.reason).toBe("invalid_timestamp");

    const noId = normalizeItem(item({ id: undefined }));
    expect(noId.ok).toBe(false);
    if (!noId.ok) expect(noId.invalid).toEqual({ platformPostId: null, reason: "missing_id" });
  });

  it("TC-COL-009: a page mixes valid and invalid items without losing the valid ones", () => {
    const page = normalizePage([item(), item({ id: "2", timestamp: undefined }), item({ id: "3" })]);
    expect(page.valid.map((p) => p.platformPostId)).toEqual(["17901234567890123", "3"]);
    expect(page.invalid).toHaveLength(1);
    expect(page.valid.length + page.invalid.length).toBe(3);
  });
});

describe("parseProviderTimestamp", () => {
  it.each([
    ["2026-09-15T10:00:00+0000", "2026-09-15T10:00:00.000Z"],
    ["2026-09-15T17:00:00+07:00", "2026-09-15T10:00:00.000Z"],
    ["2026-09-15T10:00:00Z", "2026-09-15T10:00:00.000Z"],
  ])("parses %s", (input, expected) => {
    expect(parseProviderTimestamp(input)?.toISOString()).toBe(expected);
  });

  it.each([[""], ["   "], ["not a date"], [null], [undefined], [42]])("rejects %p", (input) => {
    expect(parseProviderTimestamp(input)).toBeNull();
  });
});

describe("computeContentHash (BR-003)", () => {
  it("TC-COL-010: NFC and NFD spellings of the same text hash identically", () => {
    const nfc = "Cà phê Việt".normalize("NFC");
    const nfd = "Cà phê Việt".normalize("NFD");
    expect(nfc).not.toBe(nfd);
    expect(computeContentHash({ text: nfd })).toBe(computeContentHash({ text: nfc }));
    expect(ok(item({ text: nfd })).contentHash).toBe(ok(item({ text: nfc })).contentHash);
  });

  it("changes when text, media type or link attachment changes", () => {
    const base = computeContentHash({ text: "a", mediaType: "TEXT_POST", linkAttachmentUrl: null });
    expect(computeContentHash({ text: "b", mediaType: "TEXT_POST", linkAttachmentUrl: null })).not.toBe(base);
    expect(computeContentHash({ text: "a", mediaType: "IMAGE", linkAttachmentUrl: null })).not.toBe(base);
    expect(computeContentHash({ text: "a", mediaType: "TEXT_POST", linkAttachmentUrl: "https://x" })).not.toBe(base);
  });

  it("does not change when non-content fields change (permalink, username, has_replies)", () => {
    const a = ok(item({ username: "one", permalink: "https://a", has_replies: false })).contentHash;
    const b = ok(item({ username: "two", permalink: "https://b", has_replies: true })).contentHash;
    expect(a).toBe(b);
  });

  it("is a sha256 hex digest", () => {
    expect(computeContentHash({ text: "x" })).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("buildRawData (FR-079, BR-038)", () => {
  it("TC-COL-014: keeps only requested fields", () => {
    const { rawData, rawTruncated } = buildRawData(
      item({ insights: { views: 10 }, children: [{ id: "1" }], text: "hi" }),
    );
    expect(Object.keys(rawData).sort()).toEqual(
      ["has_replies", "id", "media_type", "permalink", "shortcode", "text", "timestamp", "username"].sort(),
    );
    expect(rawData).not.toHaveProperty("insights");
    expect(rawTruncated).toBe(false);
  });

  it("TC-COL-014: an oversized payload keeps first-level scalars and sets the truncated flag", () => {
    const quotedPost = { id: "555", children: Array.from({ length: 2000 }, (_, i) => ({ i, pad: "x".repeat(20) })) };
    const { rawData, rawTruncated } = buildRawData(item({ id: "1", quoted_post: quotedPost }));
    expect(rawTruncated).toBe(true);
    expect(rawData).not.toHaveProperty("quoted_post");
    expect(rawData["id"]).toBe("1");
    expect(rawData["username"]).toBe("fan_1zone");
    expect(Buffer.byteLength(JSON.stringify(rawData), "utf8")).toBeLessThanOrEqual(RAW_DATA_MAX_BYTES);
  });

  it("TC-COL-014: stays under the cap even when a single scalar field is oversized", () => {
    const { rawData, rawTruncated } = buildRawData(item({ text: "x".repeat(RAW_DATA_MAX_BYTES * 2) }));
    expect(rawTruncated).toBe(true);
    expect(Buffer.byteLength(JSON.stringify(rawData), "utf8")).toBeLessThanOrEqual(RAW_DATA_MAX_BYTES);
  });

  it("the truncated raw payload never shortens the stored text column", () => {
    const post = ok(item({ text: "y".repeat(RAW_DATA_MAX_BYTES * 2) }));
    expect(post.rawTruncated).toBe(true);
    expect(post.text).toHaveLength(RAW_DATA_MAX_BYTES * 2);
  });
});
