import { ProviderError } from "../../../common/errors/provider.error";
import safe from "./__fixtures__/openai-moderation/safe.json";
import sensitive from "./__fixtures__/openai-moderation/sensitive-harassment.json";
import type { FetchFn } from "./openai-http";
import { OpenAiModerationProvider } from "./openai-moderation.provider";

const ctx = { requestId: "req-1", projectId: "p", runId: "run-1" };
const API_KEY = "sk-secret-test-key";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

function setup(responses: (() => Response | Promise<Response>)[], maxRetries = 2) {
  const slept: number[] = [];
  const fetchFn = jest.fn<ReturnType<FetchFn>, Parameters<FetchFn>>();
  for (const r of responses) fetchFn.mockImplementationOnce(async () => r());
  const provider = new OpenAiModerationProvider({
    apiKey: API_KEY,
    model: "omni-moderation-latest",
    baseUrl: "https://api.openai.test/v1/",
    timeoutMs: 50,
    maxRetries,
    fetchFn,
    retry: { random: () => 1, sleep: async (ms) => void slept.push(ms) },
  });
  return { provider, fetchFn, slept };
}

describe("OpenAiModerationProvider (T-071, FR-104)", () => {
  it("maps category_scores/categories/flagged and sends model, input and Bearer key", async () => {
    const { provider, fetchFn } = setup([() => json(sensitive)]);
    const out = await provider.moderate({ text: "bài viết" }, ctx);

    expect(out.flagged).toBe(true);
    expect(out.categoryScores.harassment).toBe(0.62);
    expect(out.categories.harassment).toBe(true);
    expect(out.raw).toEqual({ id: sensitive.id, model: sensitive.model });

    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(url).toBe("https://api.openai.test/v1/moderations");
    expect(JSON.parse(String(init?.body))).toEqual({ model: "omni-moderation-latest", input: "bài viết" });
    expect((init?.headers as Record<string, string>).authorization).toBe(`Bearer ${API_KEY}`);
  });

  it("clamps scores into [0,1]", async () => {
    const body = { results: [{ flagged: false, categories: {}, category_scores: { hate: 1.2, sexual: -0.1 } }] };
    const { provider } = setup([() => json(body)]);
    const out = await provider.moderate({ text: "x" }, ctx);
    expect(out.categoryScores).toEqual({ hate: 1, sexual: 0 });
  });

  it("retries 429, 429 then succeeds; honours Retry-After, else backoff", async () => {
    const { provider, fetchFn, slept } = setup([
      () => json({ error: {} }, 429, { "retry-after": "3" }),
      () => json({ error: {} }, 429),
      () => json(safe),
    ]);
    await expect(provider.moderate({ text: "x" }, ctx)).resolves.toMatchObject({ flagged: false });
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(slept).toEqual([3_000, 4_000]); // Retry-After verbatim, then 2 s × 2^1
  });

  it("gives up with ANALYSIS_PROVIDER_ERROR after maxRetries+1 calls on persistent 500", async () => {
    const { provider, fetchFn } = setup([0, 1, 2].map(() => () => json({}, 500)));
    await expect(provider.moderate({ text: "x" }, ctx)).rejects.toMatchObject({
      code: "ANALYSIS_PROVIDER_ERROR",
      providerStatus: 500,
    });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("401 → ANALYSIS_PROVIDER_AUTH without retry, and never leaks the key", async () => {
    const { provider, fetchFn } = setup([() => json({ error: { message: "bad key" } }, 401)]);
    const error = await provider.moderate({ text: "secret post text" }, ctx).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({ code: "ANALYSIS_PROVIDER_AUTH" });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const serialized = `${String((error as Error).message)} ${JSON.stringify(error)}`;
    expect(serialized).not.toContain(API_KEY);
    expect(serialized).not.toContain("secret post text");
  });

  it("400 → ANALYSIS_PROVIDER_BAD_REQUEST without retry; keeps only error type/code, never the echoed input", async () => {
    const body = {
      error: { message: "Invalid input: 'secret post text'", type: "invalid_request_error", code: "invalid_value" },
    };
    const { provider, fetchFn } = setup([() => json(body, 400)]);
    const error = await provider.moderate({ text: "secret post text" }, ctx).catch((e: unknown) => e);
    expect(error).toMatchObject({
      code: "ANALYSIS_PROVIDER_BAD_REQUEST",
      message: "OpenAI HTTP 400: invalid_request_error/invalid_value",
    });
    expect(JSON.stringify(error)).not.toContain("secret post text");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("timeout (abort) is transient and retried", async () => {
    const hang = () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      return Promise.reject(err);
    };
    const { provider, fetchFn } = setup([hang, hang, hang]);
    await expect(provider.moderate({ text: "x" }, ctx)).rejects.toMatchObject({
      code: "ANALYSIS_PROVIDER_ERROR",
      message: expect.stringMatching(/timed out/),
    });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("body without results → ANALYSIS_SCHEMA_INVALID, not retried", async () => {
    const { provider, fetchFn } = setup([() => json({ id: "x" })]);
    await expect(provider.moderate({ text: "x" }, ctx)).rejects.toMatchObject({ code: "ANALYSIS_SCHEMA_INVALID" });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("empty text returns an empty unflagged result without calling the API", async () => {
    const { provider, fetchFn } = setup([]);
    await expect(provider.moderate({ text: "   " }, ctx)).resolves.toEqual({
      flagged: false,
      categoryScores: {},
      categories: {},
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
