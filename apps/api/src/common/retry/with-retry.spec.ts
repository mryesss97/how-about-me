import { AppError } from "../errors/app.error";
import { parseRetryAfter, ProviderError } from "../errors/provider.error";
import { computeDelayMs, DEFAULT_RETRY_POLICY, isRetryable, retryPolicyFromConfig } from "./retry.policy";
import { withRetry } from "./with-retry";

/** Records every wait instead of really sleeping, so the suite stays instant and deterministic. */
function testPolicy(over: Partial<typeof DEFAULT_RETRY_POLICY> = {}) {
  const slept: number[] = [];
  return {
    slept,
    policy: {
      baseDelayMs: 2_000,
      maxDelayMs: 60_000,
      maxRetries: 3,
      random: () => 1, // full jitter at its ceiling → assertions stay exact
      sleep: async (ms: number) => {
        slept.push(ms);
      },
      ...over,
    },
  };
}

const rateLimited = (retryAfterMs?: number) =>
  new ProviderError("THREADS_RATE_LIMITED", "429 from provider", { providerStatus: 429, ...{ retryAfterMs } });

describe("withRetry (FR-083)", () => {
  it("returns the first successful result without sleeping", async () => {
    const { slept, policy } = testPolicy();
    const fn = jest.fn().mockResolvedValue("ok");
    await expect(withRetry(fn, policy)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(slept).toEqual([]);
  });

  it("TC-COL-018: honours Retry-After verbatim and succeeds on the retry", async () => {
    const { slept, policy } = testPolicy();
    const onRetry = jest.fn();
    const fn = jest.fn().mockRejectedValueOnce(rateLimited(3_000)).mockResolvedValue("page-1");

    await expect(withRetry(fn, { ...policy, onRetry })).resolves.toBe("page-1");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(slept).toEqual([3_000]); // not jittered, never shorter than the provider asked
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry.mock.calls[0]?.[0]).toMatchObject({
      attempt: 1,
      delayMs: 3_000,
      code: "THREADS_RATE_LIMITED",
      fromRetryAfter: true,
    });
  });

  it("falls back to backoff when a 429 carries no Retry-After", async () => {
    const { slept, policy } = testPolicy();
    const fn = jest.fn().mockRejectedValueOnce(rateLimited()).mockResolvedValue("ok");
    await expect(withRetry(fn, policy)).resolves.toBe("ok");
    expect(slept).toEqual([2_000]);
  });

  it("TC-COL-019: a 400-class error is attempted once and rethrown", async () => {
    const { slept, policy } = testPolicy();
    const onGiveUp = jest.fn();
    const fn = jest.fn().mockRejectedValue(new AppError("VALIDATION_ERROR", "bad query"));

    await expect(withRetry(fn, { ...policy, onGiveUp })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(slept).toEqual([]);
    expect(onGiveUp).toHaveBeenCalledWith(expect.objectContaining({ attempts: 1, reason: "not_retryable" }));
  });

  it.each(["THREADS_UNAUTHORIZED", "THREADS_FORBIDDEN", "THREADS_MALFORMED_RESPONSE"] as const)(
    "%s is never retried",
    async (code) => {
      const { policy } = testPolicy();
      const fn = jest.fn().mockRejectedValue(new ProviderError(code));
      await expect(withRetry(fn, policy)).rejects.toMatchObject({ code });
      expect(fn).toHaveBeenCalledTimes(1);
    },
  );

  it("retries 5xx and timeouts with exponential full-jitter backoff, capped at maxDelayMs", async () => {
    const { slept, policy } = testPolicy({ maxRetries: 5, maxDelayMs: 10_000 });
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new ProviderError("THREADS_UPSTREAM_ERROR"))
      .mockRejectedValueOnce(new ProviderError("THREADS_TIMEOUT"))
      .mockRejectedValueOnce(new ProviderError("THREADS_UPSTREAM_ERROR"))
      .mockRejectedValueOnce(new ProviderError("THREADS_UPSTREAM_ERROR"))
      .mockResolvedValue("ok");

    await expect(withRetry(fn, policy)).resolves.toBe("ok");
    expect(slept).toEqual([2_000, 4_000, 8_000, 10_000]);
  });

  it("stops after maxRetries and rethrows the last error", async () => {
    const { slept, policy } = testPolicy({ maxRetries: 3 });
    const onGiveUp = jest.fn();
    const fn = jest.fn().mockRejectedValue(new ProviderError("THREADS_UPSTREAM_ERROR", "502"));

    await expect(withRetry(fn, { ...policy, onGiveUp })).rejects.toMatchObject({ code: "THREADS_UPSTREAM_ERROR" });
    expect(fn).toHaveBeenCalledTimes(4); // 1 attempt + 3 retries
    expect(slept).toHaveLength(3);
    expect(onGiveUp).toHaveBeenCalledWith(expect.objectContaining({ attempts: 4, reason: "exhausted" }));
  });

  it("gives up instead of parking a worker when Retry-After exceeds the budget", async () => {
    const { slept, policy } = testPolicy({ maxRetryAfterMs: 60_000 });
    const onGiveUp = jest.fn();
    const fn = jest.fn().mockRejectedValue(rateLimited(15 * 60_000));

    await expect(withRetry(fn, { ...policy, onGiveUp })).rejects.toMatchObject({ code: "THREADS_RATE_LIMITED" });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(slept).toEqual([]);
    expect(onGiveUp).toHaveBeenCalledWith(expect.objectContaining({ reason: "retry_after_too_long" }));
  });

  it("retries a bare network error that the adapter could not map", async () => {
    const { policy } = testPolicy();
    const fn = jest.fn().mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValue("ok");
    await expect(withRetry(fn, policy)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("passes the attempt number to the callee so a resumed page can be logged", async () => {
    const { policy } = testPolicy();
    const seen: number[] = [];
    await withRetry(async (attempt) => {
      seen.push(attempt);
      if (attempt < 3) throw new ProviderError("THREADS_TIMEOUT");
      return "ok";
    }, policy);
    expect(seen).toEqual([1, 2, 3]);
  });
});

describe("policy helpers", () => {
  it("maxRetries comes from COLLECTOR_MAX_RETRIES", () => {
    expect(retryPolicyFromConfig({ COLLECTOR_MAX_RETRIES: 5 }).maxRetries).toBe(5);
    expect(retryPolicyFromConfig({ COLLECTOR_MAX_RETRIES: 5 }).baseDelayMs).toBe(DEFAULT_RETRY_POLICY.baseDelayMs);
  });

  it("full jitter never exceeds the exponential ceiling", () => {
    const policy = { ...DEFAULT_RETRY_POLICY, random: () => 0.5 };
    expect(computeDelayMs(1, new ProviderError("THREADS_TIMEOUT"), policy)).toBe(1_000);
    expect(computeDelayMs(4, new ProviderError("THREADS_TIMEOUT"), policy)).toBe(8_000);
    expect(computeDelayMs(20, new ProviderError("THREADS_TIMEOUT"), policy)).toBe(30_000); // capped at 60 s ceiling
  });

  it("classifies errors per the FR-083 table", () => {
    expect(isRetryable(new ProviderError("THREADS_RATE_LIMITED"))).toBe(true);
    expect(isRetryable(new ProviderError("THREADS_UNAUTHORIZED"))).toBe(false);
    expect(isRetryable(new AppError("NOT_FOUND"))).toBe(false);
    expect(isRetryable("not an error")).toBe(false);
  });
});

describe("parseRetryAfter", () => {
  const now = new Date("2026-09-15T10:00:00Z");

  it("parses delta-seconds", () => {
    expect(parseRetryAfter("3", now)).toBe(3_000);
    expect(parseRetryAfter(["7"], now)).toBe(7_000);
  });

  it("parses an HTTP-date and clamps past dates to zero", () => {
    expect(parseRetryAfter("Tue, 15 Sep 2026 10:00:30 GMT", now)).toBe(30_000);
    expect(parseRetryAfter("Tue, 15 Sep 2026 09:59:00 GMT", now)).toBe(0);
  });

  it.each([[undefined], [null], [""], ["   "], ["soon"]])("returns undefined for %p", (header) => {
    expect(parseRetryAfter(header, now)).toBeUndefined();
  });
});
