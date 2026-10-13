import { ListeningQuerySchema } from "@how-about-me/contracts";
import { makeRow } from "./listening-queries.fixtures";
import { toListeningQuery } from "./listening-queries.repository";

describe("toListeningQuery", () => {
  it("maps dates to ISO Z, placeholders and missing creator → null; parses with contract", () => {
    const dto = toListeningQuery(makeRow(), new Map());
    expect(dto.nextRunAt).toBe("2026-10-01T00:00:00.000Z");
    expect(dto.lastError).toBeNull();
    expect(dto.createdBy).toBeNull();
    expect(dto.lastJob).toBeNull();
    expect(dto.matchedPosts).toEqual({ total: 0, last24h: 0 });
    expect(ListeningQuerySchema.safeParse(dto).success).toBe(true);
  });
  it("maps lastError and createdBy when present", () => {
    const row = makeRow({
      lastErrorAt: new Date("2026-10-02T00:00:00Z"),
      lastErrorCode: "PROVIDER_RATE_LIMITED",
      lastErrorMessage: null,
      deletedAt: new Date("2026-10-03T00:00:00Z"),
    });
    const creators = new Map([[row.createdBy as string, { id: row.createdBy as string, displayName: "Admin" }]]);
    const dto = toListeningQuery(row, creators);
    expect(dto.lastError).toEqual({ code: "PROVIDER_RATE_LIMITED", message: "", at: "2026-10-02T00:00:00.000Z" });
    expect(dto.createdBy).toEqual({ id: row.createdBy, displayName: "Admin" });
    expect(dto.deletedAt).toBe("2026-10-03T00:00:00.000Z");
    expect(ListeningQuerySchema.safeParse(dto).success).toBe(true);
  });
});
