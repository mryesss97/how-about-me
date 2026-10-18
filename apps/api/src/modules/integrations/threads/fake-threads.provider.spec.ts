import { withRetry } from "../../../common/retry";
import { FakeThreadsProvider } from "./fake-threads.provider";
import type { ProviderContext, SearchInput } from "./social-discovery.provider";

const NOW = new Date("2026-09-15T10:00:00.000Z");
const CTX: ProviderContext = { accessToken: "unused-by-the-fake", requestId: "req-1", projectId: "p-1" };

const search = (query: string, over: Partial<SearchInput> = {}): SearchInput => ({
  query,
  searchMode: "KEYWORD",
  searchType: "RECENT",
  ...over,
});

describe("FakeThreadsProvider (FR-112, FR-047)", () => {
  let provider: FakeThreadsProvider;
  beforeEach(() => {
    provider = new FakeThreadsProvider(() => NOW);
  });

  it("returns the same items for the same query — no randomness, no network", async () => {
    const a = await provider.search(search("1zone"), CTX);
    provider.reset();
    const b = await provider.search(search("1zone"), CTX);
    expect(a.items).toEqual(b.items);
    expect(a.requestDurationMs).toBe(b.requestDurationMs);
  });

  it("TC-COL-007: paginates until the last page", async () => {
    const seen: string[] = [];
    let cursor: string | undefined;
    let pages = 0;
    do {
      const page = await provider.search(search("fake-multipage", { cursor }), CTX);
      seen.push(...page.items.map((i) => String(i["id"])));
      cursor = page.nextCursor;
      pages++;
    } while (cursor && pages < 10);

    expect(pages).toBe(3);
    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
  });

  it("TC-COL-024: fake-fail-page-3 serves pages 1–2 then fails page 3 every time", async () => {
    const p1 = await provider.search(search("fake-fail-page-3"), CTX);
    const p2 = await provider.search(search("fake-fail-page-3", { cursor: p1.nextCursor }), CTX);
    expect(p2.nextCursor).toBe("fake-page-2");
    for (let i = 0; i < 2; i++)
      await expect(provider.search(search("fake-fail-page-3", { cursor: p2.nextCursor }), CTX)).rejects.toMatchObject({
        code: "THREADS_MALFORMED_RESPONSE",
      });
  });

  it("TC-COL-012: the same post is returned by two different queries (one post, two matches)", async () => {
    const oneZone = await provider.search(search("1zone"), CTX);
    const eventista = await provider.search(search("eventista"), CTX);
    const shared = oneZone.items.filter((a) => eventista.items.some((b) => b["id"] === a["id"]));
    expect(shared).toHaveLength(1);
    expect(shared[0]?.["id"]).toBe("fake_post_overlap_0001");
  });

  it("serves an empty page for the '0 mentions' state (BR-032)", async () => {
    const page = await provider.search(search("fake-empty"), CTX);
    expect(page.items).toEqual([]);
    expect(page.nextCursor).toBeUndefined();
  });

  it("TC-COL-009: the invalid-items scenario mixes valid and unusable items", async () => {
    const page = await provider.search(search("fake-invalid-items"), CTX);
    expect(page.items).toHaveLength(3);
    expect(page.items.filter((i) => i["timestamp"] === undefined || i["id"] === undefined)).toHaveLength(2);
  });

  it("TC-COL-018: fake-429 fails once with Retry-After, then succeeds — and withRetry handles it", async () => {
    const slept: number[] = [];
    const page = await withRetry(() => provider.search(search("fake-429"), CTX), {
      sleep: async (ms) => {
        slept.push(ms);
      },
    });
    expect(slept).toEqual([3_000]);
    expect(page.items.length).toBeGreaterThan(0);
  });

  it.each([
    ["fake-401", "THREADS_UNAUTHORIZED", 401],
    ["fake-403", "THREADS_FORBIDDEN", 403],
    ["fake-500", "THREADS_UPSTREAM_ERROR", 500],
    ["fake-400", "VALIDATION_ERROR", 400],
  ])("TC-COL-017: %s maps to %s", async (query, code, status) => {
    await expect(provider.search(search(query), CTX)).rejects.toMatchObject({ code, providerStatus: status });
  });

  it("TC-COL-017: fake-timeout and fake-malformed map to their codes", async () => {
    await expect(provider.search(search("fake-timeout"), CTX)).rejects.toMatchObject({ code: "THREADS_TIMEOUT" });
    await expect(provider.search(search("fake-malformed"), CTX)).rejects.toMatchObject({
      code: "THREADS_MALFORMED_RESPONSE",
    });
  });

  it("TC-COL-013: fake-changed-text returns the same id with new text from the second run on", async () => {
    const first = await provider.search(search("fake-changed-text"), CTX);
    const second = await provider.search(search("fake-changed-text"), CTX);
    expect(second.items[0]?.["id"]).toBe(first.items[0]?.["id"]);
    expect(second.items[0]?.["text"]).not.toBe(first.items[0]?.["text"]);

    provider.reset();
    const afterReset = await provider.search(search("fake-changed-text"), CTX);
    expect(afterReset.items[0]?.["text"]).toBe(first.items[0]?.["text"]);
  });

  it("filters client-side by the requested window, like the collector fallback path", async () => {
    const all = await provider.search(search("1zone"), CTX);
    const recent = await provider.search(search("1zone", { since: new Date(NOW.getTime() - 30 * 60_000) }), CTX);
    expect(recent.items.length).toBeGreaterThan(0);
    expect(recent.items.length).toBeLessThan(all.items.length);
  });

  it("honours the page limit and reports rate-limit metadata", async () => {
    const page = await provider.search(search("1zone", { limit: 2 }), CTX);
    expect(page.items).toHaveLength(2);
    expect(page.rateLimit?.remaining).toBe(199);
    expect(page.rateLimit?.raw).toHaveProperty("x-app-usage");
  });

  it("strips a leading # so topic-tag queries resolve to the same scenario (BR-004)", async () => {
    const tag = await provider.search(search("#1zone", { searchMode: "TAG" }), CTX);
    provider.reset();
    const keyword = await provider.search(search("1zone"), CTX);
    expect(tag.items).toEqual(keyword.items);
  });

  it("falls back to the default dataset for an unknown query value", async () => {
    const unknown = await provider.search(search("brand-nobody-configured"), CTX);
    expect(unknown.items.length).toBeGreaterThan(0);
  });

  it("verifyConnection reports a connected account without touching the network", async () => {
    const info = await provider.verifyConnection(CTX);
    expect(info.accountIdentifier).toBe("fake_brand_account");
    expect(info.grantedScopes).toContain("threads_keyword_search");
  });

  it("T-038: verifyConnection honours the fake-invalid / fake-forbidden token sentinels", async () => {
    await expect(provider.verifyConnection({ ...CTX, accessToken: "fake-invalid-0000000000" })).rejects.toMatchObject({
      code: "THREADS_UNAUTHORIZED",
      providerStatus: 401,
    });
    await expect(provider.verifyConnection({ ...CTX, accessToken: "fake-forbidden-00000000" })).rejects.toMatchObject({
      code: "THREADS_FORBIDDEN",
      providerStatus: 403,
    });
  });

  it("lists its scenarios so a developer can discover them", () => {
    const keys = provider.listScenarios().map((s) => s.key);
    expect(keys).toEqual(expect.arrayContaining(["1zone", "eventista", "fake-429", "fake-malformed"]));
  });

  it("contains no token-like or personal data in its fixtures", async () => {
    const page = await provider.search(search("1zone"), CTX);
    const json = JSON.stringify(page.items);
    expect(json).not.toMatch(/access_token|Bearer |EAAB|THQVJ/i);
    expect(json).not.toMatch(/\b\d{9,}@|@gmail\.com/i);
  });
});
