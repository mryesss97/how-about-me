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
  it("T-045 FR-061: maps lastJob / matchedPosts from the summary map", () => {
    const row = makeRow();
    const summaries = new Map([
      [
        row.id,
        {
          lastJob: {
            id: "0192f000-0000-7000-8000-000000000001",
            status: "success" as const,
            recordsFetched: 40,
            recordsInserted: 3,
            completedAt: "2026-10-02T00:00:00.000Z",
          },
          matchedPosts: { total: 2, last24h: 1 },
        },
      ],
    ]);
    const dto = toListeningQuery(row, new Map(), summaries);
    expect(dto.lastJob?.recordsFetched).toBe(40);
    expect(dto.matchedPosts).toEqual({ total: 2, last24h: 1 });
    expect(ListeningQuerySchema.safeParse(dto).success).toBe(true);
  });
});
