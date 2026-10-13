import type { MentionsExportQuery } from "@how-about-me/contracts";
import type { Prisma } from "@prisma/client";
import type { PinoLogger } from "nestjs-pino";
import type { AppConfig } from "../../config/config.module";
import type { AuditService } from "../audit/audit.service";
import type { MentionPageRow, MentionsRepository } from "../mentions/mentions.repository";
import type { ExportThrottle } from "./export-throttle";
import { ExportService } from "./export.service";

const PID = "00000000-0000-7000-8000-000000000001";
const ACTOR = "00000000-0000-7000-8000-000000000003";
const NOW = new Date("2026-10-13T17:30:00Z");
const query = {
  from: "2026-10-01T00:00:00Z",
  to: "2026-10-08T00:00:00Z",
  relevance: ["relevant"],
  sort: "oldest",
  q: "giá",
} as unknown as MentionsExportQuery;

function row(i: number): MentionPageRow {
  return {
    post_id: `p${i}`,
    platform: "threads",
    platform_post_id: `pp${i}`,
    username: "u",
    permalink: null,
    published_at: new Date("2026-10-02T00:00:00Z"),
    text: `secret text ${i}`,
    media_type: null,
    thumbnail_url: null,
    has_replies: null,
    is_quote_post: null,
    latest_run_status: "completed",
    analysis_id: `a${i}`,
    relevance_label: "relevant",
    relevance_confidence: 0.9,
    sentiment_label: "neutral",
    sentiment_confidence: 0.9,
    safety_level: "safe",
    language_code: "vi",
    summary: null,
    overall_model_confidence: 0.9,
    has_override: false,
    high_band: 0.8,
    medium_band: 0.6,
    keys: [],
  };
}

function setup(opts: { rows?: number; cap?: number; throttleError?: Error } = {}) {
  const tx = {} as Prisma.TransactionClient;
  const rows = Array.from({ length: opts.rows ?? 2 }, (_v, i) => row(i));
  const repo = {
    transaction: jest.fn((fn: (t: Prisma.TransactionClient) => Promise<unknown>) => fn(tx)),
    listPage: jest.fn().mockResolvedValue(rows),
    hydrate: jest
      .fn()
      .mockResolvedValue({ matches: new Map(), intents: new Map(), topics: new Map(), errorCodes: new Map() }),
    analyzedAtByAnalysis: jest.fn().mockResolvedValue(new Map()),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const throttle = {
    assertAllowed: opts.throttleError ? jest.fn().mockRejectedValue(opts.throttleError) : jest.fn(),
  };
  const svc = new ExportService(
    repo as unknown as MentionsRepository,
    audit as unknown as AuditService,
    throttle as unknown as ExportThrottle,
    { EXPORT_MAX_ROWS: opts.cap ?? 10_000 } as AppConfig,
    { info: jest.fn(), warn: jest.fn() } as unknown as PinoLogger,
  );
  return { svc, repo, audit, throttle, tx };
}

async function readAll(stream: NodeJS.ReadableStream): Promise<string> {
  let s = "";
  for await (const c of stream) s += String(c);
  return s;
}

describe("ExportService.exportMentionsCsv (T-147)", () => {
  it("FR-181 / TC-EXP-002: cap+1 rows → EXPORT_TOO_LARGE {cap}, no audit", async () => {
    const { svc, audit } = setup({ rows: 4, cap: 3 });
    await expect(svc.exportMentionsCsv(PID, query, ACTOR, null, NOW)).rejects.toMatchObject({
      code: "EXPORT_TOO_LARGE",
      details: { cap: 3 },
    });
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("FR-200 / TC-EXP-004: audits in the tx with filters + rowCount, no post text", async () => {
    const { svc, audit, tx } = setup({ rows: 2 });
    const out = await svc.exportMentionsCsv(PID, query, ACTOR, "req-1", NOW);
    expect(out.rowCount).toBe(2);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "mentions.exported",
        entityType: "monitoring_project",
        entityId: PID,
        projectId: PID,
        actorUserId: ACTOR,
        requestId: "req-1",
        metadata: { format: "csv", filters: query, rowCount: 2 },
      }),
      tx,
    );
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain("secret text");
  });

  it("NFR-017: throttle error → no query, no audit", async () => {
    const { svc, repo, audit } = setup({ throttleError: new Error("limited") });
    await expect(svc.exportMentionsCsv(PID, query, ACTOR, null, NOW)).rejects.toThrow("limited");
    expect(repo.listPage).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("passes q/sort and limit=cap to listPage within the tx", async () => {
    const { svc, repo, tx } = setup({ cap: 7 });
    await svc.exportMentionsCsv(PID, query, ACTOR, null, NOW);
    expect(repo.listPage).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: PID }),
      "giá",
      "oldest",
      null,
      7,
      tx,
    );
  });

  it("streams BOM + header + all rows, hydrating in chunks of 500 (BR-002)", async () => {
    const { svc, repo } = setup({ rows: 1001 });
    const out = await svc.exportMentionsCsv(PID, query, ACTOR, null, NOW);
    const body = await readAll(out.stream);
    expect(body.startsWith("\uFEFFpost_id,")).toBe(true);
    expect(body.split("\r\n").filter(Boolean)).toHaveLength(1002);
    expect(repo.hydrate).toHaveBeenCalledTimes(3);
    expect(out.filename).toBe("mentions-20261014-0030.csv");
  });
});
