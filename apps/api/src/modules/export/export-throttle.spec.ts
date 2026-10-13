import type { Prisma } from "@prisma/client";
import { clampRetryAfter, ExportThrottle } from "./export-throttle";

/** NFR-017 / TC-EXP-006: 5 exports per minute per user. */
describe("ExportThrottle", () => {
  it("clamps retryAfterSeconds to 1..60", () => {
    expect(clampRetryAfter(0)).toBe(1);
    expect(clampRetryAfter(12.2)).toBe(13);
    expect(clampRetryAfter(500)).toBe(60);
  });

  const tx = (n: number, wait: number | null) =>
    ({
      $queryRaw: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{ n, wait }]),
    }) as unknown as Prisma.TransactionClient;

  it("allows under the limit", async () => {
    await expect(new ExportThrottle().assertAllowed(tx(4, 30), "u")).resolves.toBeUndefined();
  });

  it("6th request → RATE_LIMITED with retryAfterSeconds", async () => {
    await expect(new ExportThrottle().assertAllowed(tx(5, 42), "u")).rejects.toMatchObject({
      code: "RATE_LIMITED",
      details: { retryAfterSeconds: 42 },
    });
  });
});
