import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ProviderError } from "../../../common/errors/provider.error";
import { isRetryable } from "../../../common/retry/retry.policy";
import type { ProviderContext, SearchInput } from "./social-discovery.provider";
import { THREADS_SEARCH_FIELDS, ThreadsDiscoveryProvider } from "./threads-discovery.provider";
import { redact } from "./threads-error.mapper";
import type { FetchFn } from "./threads-http";

/** Contract tests over the anonymised fixtures in `__fixtures__/http` (T-039; TC-COL-017, TC-COL-026). No network. */
const FIXTURES = join(__dirname, "__fixtures__", "http");
const fixture = (name: string) => readFileSync(join(FIXTURES, name), "utf8");

const BASE = "https://graph.example.test/v1.0";
const TOKEN = "PLACEHOLDER_TOKEN_abc123";
const ctx: ProviderContext = { accessToken: TOKEN, requestId: "req-1", projectId: "p1" };
const input: SearchInput = { query: "#sky", searchMode: "KEYWORD", searchType: "RECENT" };

type Call = { url: string; init: RequestInit };

/** Recorded call #i, failing the test when the provider made fewer calls. */
function nth(calls: Call[], i: number): Call {
  const call = calls[i];
  if (!call) throw new Error(`expected call #${i}, got ${calls.length} call(s)`);
  return call;
}

function respond(body: string, status = 200, headers: Record<string, string> = {}) {
  return new Response(body, { status, headers: { "content-type": "application/json", ...headers } });
}

function setup(responses: Array<Response | (() => Promise<Response>)>, timeoutMs = 1_000) {
  const calls: Call[] = [];
  let t = 1_000;
  const fetchFn: FetchFn = async (url, init) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error("unexpected call");
    return typeof next === "function" ? next() : next;
  };
  const provider = new ThreadsDiscoveryProvider({
    baseUrl: BASE,
    timeoutMs,
    fetchFn,
    clock: () => (t += 25),
  });
  return { provider, calls };
}

async function caught(p: Promise<unknown>): Promise<ProviderError> {
  try {
    await p;
  } catch (e) {
    if (e instanceof ProviderError) return e;
    throw e;
  }
  throw new Error("expected a ProviderError");
}

describe("ThreadsDiscoveryProvider.search (FR-047, BR-038)", () => {
  it("builds the keyword_search request with Bearer auth and no token in the URL (BR-036)", async () => {
    const { provider, calls } = setup([respond(fixture("search-page-1.json"))]);
    await provider.search(
      {
        ...input,
        limit: 25,
        since: new Date("2026-07-01T00:00:00.500Z"),
        until: new Date("2026-07-02T00:00:00Z"),
        cursor: "CUR",
      },
      ctx,
    );
    const url = new URL(nth(calls, 0).url);
    expect(`${url.origin}${url.pathname}`).toBe(`${BASE}/keyword_search`);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: "sky",
      search_type: "RECENT",
      search_mode: "KEYWORD",
      fields: THREADS_SEARCH_FIELDS,
      limit: "25",
      since: String(Date.UTC(2026, 6, 1) / 1000),
      until: String(Date.UTC(2026, 6, 2) / 1000),
      after: "CUR",
    });
    expect(nth(calls, 0).url).not.toContain(TOKEN);
    expect(nth(calls, 0).url).not.toContain("access_token");
    expect((nth(calls, 0).init.headers as Record<string, string>)["authorization"]).toBe(`Bearer ${TOKEN}`);
  });

  it("BR-038: requests exactly the doc 06 §2 field list", () => {
    expect(THREADS_SEARCH_FIELDS.split(",")).toHaveLength(15);
    expect(THREADS_SEARCH_FIELDS).toContain("link_attachment_url");
  });

  it("returns items and the next cursor while paging.next exists", async () => {
    const { provider } = setup([respond(fixture("search-page-1.json"))]);
    const page = await provider.search(input, ctx);
    expect(page.items).toHaveLength(2);
    expect(page.items[0]).toMatchObject({ id: "10000000000000001", timestamp: "2026-07-01T13:25:35+0000" });
    expect(page.nextCursor).toBe("CURSOR_AFTER_1");
    expect(page.requestDurationMs).toBe(25);
    expect(page.rateLimit).toBeUndefined();
  });

  it("has no next cursor on the last page and handles an empty page", async () => {
    const { provider } = setup([respond(fixture("search-page-last.json")), respond(fixture("search-empty.json"))]);
    const last = await provider.search(input, ctx);
    expect(last.nextCursor).toBeUndefined();
    const empty = await provider.search(input, ctx);
    expect(empty).toMatchObject({ items: [] });
    expect(empty.nextCursor).toBeUndefined();
  });

  it("TC-COL-026 / FR-089: surfaces allow-listed rate-limit headers only", async () => {
    const { provider } = setup([
      respond(fixture("search-empty.json"), 200, {
        "x-app-usage": '{"call_count":40,"total_time":10,"total_cputime":5}',
        "x-business-use-case-usage": '{"123":[{"estimated_time_to_regain_access":2}]}',
        "set-cookie": "sid=secret",
        "x-other": "nope",
      }),
    ]);
    const page = await provider.search(input, ctx);
    expect(page.rateLimit?.remaining).toBe(60);
    expect(page.rateLimit?.resetAt?.getTime()).toBe(1_075 + 120_000); // 3rd clock tick (start, end, now) + 2 minutes
    expect(Object.keys(page.rateLimit?.raw ?? {}).sort()).toEqual(["x-app-usage", "x-business-use-case-usage"]);
  });

  it("FR-089: x-ratelimit-remaining wins and bad JSON headers are kept raw but ignored", async () => {
    const { provider } = setup([
      respond(fixture("search-empty.json"), 200, { "x-ratelimit-remaining": "7", "x-app-usage": "{oops" }),
    ]);
    const page = await provider.search(input, ctx);
    expect(page.rateLimit).toMatchObject({
      remaining: 7,
      raw: { "x-ratelimit-remaining": "7", "x-app-usage": "{oops" },
    });
  });
});

describe("Threads error mapping (TC-COL-017, FR-082)", () => {
  it.each([
    ["401 → UNAUTHORIZED", 401, "{}", {}, "THREADS_UNAUTHORIZED", undefined],
    [
      "400 + code 190 → UNAUTHORIZED",
      400,
      fixture("error-oauth-190.json"),
      {},
      "THREADS_UNAUTHORIZED",
      "190/463 PLACEHOLDER_TRACE",
    ],
    ["403 → FORBIDDEN", 403, "{}", {}, "THREADS_FORBIDDEN", undefined],
    [
      "400 + code 10 (POC body) → FORBIDDEN",
      400,
      fixture("error-permission-code10.json"),
      {},
      "THREADS_FORBIDDEN",
      "10/",
    ],
    ["429 → RATE_LIMITED", 429, "{}", { "retry-after": "3" }, "THREADS_RATE_LIMITED", undefined],
    ["400 + code 4 → RATE_LIMITED", 400, fixture("error-rate-limit-code4.json"), {}, "THREADS_RATE_LIMITED", "4/"],
    ["500 → UPSTREAM", 500, fixture("error-5xx.json"), {}, "THREADS_UPSTREAM_ERROR", "2/"],
    ["503 → UPSTREAM", 503, "not json", {}, "THREADS_UPSTREAM_ERROR", undefined],
    ["400 + code 100 → UPSTREAM", 400, fixture("error-bad-request-100.json"), {}, "THREADS_UPSTREAM_ERROR", "100/"],
  ])("%s", async (_name, status, body, headers, code, subcode) => {
    const { provider } = setup([respond(body, status, headers)]);
    const err = await caught(provider.search(input, ctx));
    expect(err.code).toBe(code);
    expect(err.providerStatus).toBe(status);
    expect(err.subcode).toBe(subcode);
    expect(err.message).toContain("/keyword_search");
    expect(err.message).not.toContain("permission for this action");
  });

  it("429 carries Retry-After in ms and is retryable", async () => {
    const { provider } = setup([respond("{}", 429, { "retry-after": "3" })]);
    const err = await caught(provider.search(input, ctx));
    expect(err.retryAfterMs).toBe(3_000);
    expect(isRetryable(err)).toBe(true);
  });

  it("decision 2026-11-11: a plain 400 is UPSTREAM_ERROR but never retried; a 5xx is retried", async () => {
    const { provider } = setup([respond(fixture("error-bad-request-100.json"), 400), respond("{}", 502)]);
    expect(isRetryable(await caught(provider.search(input, ctx)))).toBe(false);
    expect(isRetryable(await caught(provider.search(input, ctx)))).toBe(true);
  });

  it("times out (abort covers a hanging request) → THREADS_TIMEOUT", async () => {
    const provider = new ThreadsDiscoveryProvider({
      baseUrl: BASE,
      timeoutMs: 20,
      // Never answers; only the adapter's abort signal ends the request.
      fetchFn: (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    });
    const err = await caught(provider.search(input, ctx));
    expect(err.code).toBe("THREADS_TIMEOUT");
    expect(err.message).toMatch(/timed out after 20 ms/);
  });

  it("a network failure → THREADS_TIMEOUT", async () => {
    const { provider } = setup([() => Promise.reject(new TypeError("fetch failed"))]);
    expect((await caught(provider.search(input, ctx))).code).toBe("THREADS_TIMEOUT");
  });

  it.each([
    ["truncated JSON", fixture("malformed.txt")],
    ["missing data", "{}"],
    ["item is not an object", '{"data":[1]}'],
  ])("200 with %s → THREADS_MALFORMED_RESPONSE", async (_n, body) => {
    const { provider } = setup([respond(body)]);
    const err = await caught(provider.search(input, ctx));
    expect(err.code).toBe("THREADS_MALFORMED_RESPONSE");
    expect(isRetryable(err)).toBe(false);
    expect(err.details).toHaveProperty("sample");
  });

  it("BR-036: no token leaks into any error, even when upstream echoes it", async () => {
    const echo = `{"error":{"message":"bad access_token=${TOKEN}","type":"OAuthException","code":190}}`;
    const bodies: Array<[string, number]> = [
      [echo, 400],
      [echo, 500],
      [`not json access_token=${TOKEN} Bearer ${TOKEN}`, 200],
      ...readdirSync(FIXTURES)
        .filter((f) => f.startsWith("error-"))
        .map((f): [string, number] => [fixture(f), 400]),
    ];
    for (const [body, status] of bodies) {
      const { provider } = setup([respond(body, status)]);
      const err = await caught(provider.search(input, ctx));
      expect(JSON.stringify({ m: err.message, d: err.details, s: err.subcode })).not.toContain(TOKEN);
    }
  });

  it("redact() masks token-like substrings", () => {
    expect(redact(`x?access_token=${TOKEN}&input_token=${TOKEN} Bearer ${TOKEN}`)).toBe(
      "x?access_token=***&input_token=*** Bearer ***",
    );
  });
});

describe("ThreadsDiscoveryProvider.verifyConnection (FR-045)", () => {
  it("reads the account from /me and scopes/expiry from /debug_token", async () => {
    const { provider, calls } = setup([respond(fixture("me.json")), respond(fixture("debug-token.json"))]);
    await expect(provider.verifyConnection(ctx)).resolves.toEqual({
      accountIdentifier: "tester_username",
      grantedScopes: ["threads_basic", "threads_keyword_search"],
      tokenExpiresAt: new Date(1793318400 * 1000),
    });
    expect(new URL(nth(calls, 0).url).pathname).toBe("/v1.0/me");
    expect(nth(calls, 0).url).not.toContain(TOKEN);
    expect(new URL(nth(calls, 1).url).pathname).toBe("/v1.0/debug_token");
    // Q2 decision: Meta's mandatory `input_token` is the only place the token is in a URL.
    expect(new URL(nth(calls, 1).url).searchParams.get("input_token")).toBe(TOKEN);
    expect(nth(calls, 1).url).not.toContain("access_token");
  });

  it("expires_at 0 (never expires) → tokenExpiresAt null", async () => {
    const { provider } = setup([
      respond(fixture("me.json")),
      respond('{"data":{"is_valid":true,"scopes":["threads_basic"],"expires_at":0}}'),
    ]);
    expect((await provider.verifyConnection(ctx)).tokenExpiresAt).toBeNull();
  });

  it("is_valid false → THREADS_UNAUTHORIZED", async () => {
    const { provider } = setup([respond(fixture("me.json")), respond(fixture("debug-token-invalid.json"))]);
    expect((await caught(provider.verifyConnection(ctx))).code).toBe("THREADS_UNAUTHORIZED");
  });

  it("/me 401 → THREADS_UNAUTHORIZED; code 10 → THREADS_FORBIDDEN", async () => {
    const a = setup([respond("{}", 401)]);
    expect((await caught(a.provider.verifyConnection(ctx))).code).toBe("THREADS_UNAUTHORIZED");
    const b = setup([respond(fixture("me.json")), respond(fixture("error-permission-code10.json"), 403)]);
    const err = await caught(b.provider.verifyConnection(ctx));
    expect(err.code).toBe("THREADS_FORBIDDEN");
    expect(err.message).toContain("/debug_token");
    expect(err.message).not.toContain(TOKEN);
  });
});
