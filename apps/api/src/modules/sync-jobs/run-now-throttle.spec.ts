import type { Prisma } from "@prisma/client";
import { RUN_NOW_THROTTLE_LIMIT, RunNowThrottle, clampRunNowRetryAfter } from "./run-now-throttle";

/** NFR-017 / TC-LQ-015: run-now throttle 10/min/project. */
describe("RunNowThrottle (NFR-017)", () => {
  const tx = (n: number, wait: number | null) =>
    ({
      $queryRaw: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{ n, wait }]),
    }) as unknown as Prisma.TransactionClient;
  const pid = "00000000-0000-7000-8000-000000000001";

  it("allows below the limit", async () => {
    await expect(new RunNowThrottle().assertAllowed(tx(RUN_NOW_THROTTLE_LIMIT - 1, 30), pid)).resolves.toBeUndefined();
  });

  it("rejects at the limit with RATE_LIMITED + retryAfterSeconds", async () => {
    await expect(new RunNowThrottle().assertAllowed(tx(RUN_NOW_THROTTLE_LIMIT, 42), pid)).rejects.toMatchObject({
      code: "RATE_LIMITED",
      details: { retryAfterSeconds: 42 },
    });
  });

  it("clamps retryAfter to [1, 60]", () => {
    expect(clampRunNowRetryAfter(0)).toBe(1);
    expect(clampRunNowRetryAfter(500)).toBe(60);
    expect(clampRunNowRetryAfter(12.2)).toBe(13);
  });
});
