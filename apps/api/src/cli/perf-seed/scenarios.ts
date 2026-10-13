/**
 * `perf:explain` scenarios (T-097): every analytics / mentions / export read path, driven through the real
 * services/repositories so the measured SQL is exactly what the API sends (no copied SQL).
 */
import {
  AnalyticsQuerySchema,
  MentionsExportQuerySchema,
  MentionsListQuerySchema,
  TimeseriesQuerySchema,
} from "@how-about-me/contracts";
import type { PrismaService } from "../../database/prisma.service";
import { AnalyticsDistributionsRepository } from "../../modules/analytics/analytics-distributions.repository";
import { AnalyticsDistributionsService } from "../../modules/analytics/analytics-distributions.service";
import { AnalyticsQueryShareRepository } from "../../modules/analytics/analytics-query-share.repository";
import { AnalyticsQueryShareService } from "../../modules/analytics/analytics-query-share.service";
import { AnalyticsTimeseriesRepository } from "../../modules/analytics/analytics-timeseries.repository";
import { AnalyticsTimeseriesService } from "../../modules/analytics/analytics-timeseries.service";
import { OverviewRepository } from "../../modules/analytics/overview.repository";
import { OverviewService } from "../../modules/analytics/overview.service";
import { ExportThrottle } from "../../modules/export/export-throttle";
import { resolveFilterScope, resolveMentionsScope } from "../../modules/mentions/mentions-query";
import { MentionsRepository } from "../../modules/mentions/mentions.repository";

export type ScenarioCtx = { projectId: string; postId: string; actorUserId: string; now: Date; exportCap: number };
export type Scenario = { name: string; nfr: string; run: (db: PrismaService) => Promise<unknown> };

const DAY = 86_400_000;
const SORTS = ["newest", "oldest", "safety_desc", "confidence_asc", "relevance_desc"] as const;

function range(now: Date, days: number): { from: string; to: string } {
  return { from: new Date(now.getTime() - days * DAY).toISOString(), to: now.toISOString() };
}

export function buildScenarios(ctx: ScenarioCtx): Scenario[] {
  const { projectId: pid, now } = ctx;
  const r7 = range(now, 7);
  const r30 = range(now, 30);
  const analytics = (db: PrismaService) => {
    const ts = new AnalyticsTimeseriesService(new AnalyticsTimeseriesRepository(db));
    return {
      overview: new OverviewService(new OverviewRepository(db)),
      ts,
      dist: new AnalyticsDistributionsService(new AnalyticsDistributionsRepository(db), ts),
      share: new AnalyticsQueryShareService(new AnalyticsQueryShareRepository(db)),
    };
  };
  const aq = (extra: Record<string, unknown>) => AnalyticsQuerySchema.parse(extra);

  const list = (label: string, query: Record<string, unknown>, nfr = "NFR-002 < 1000 ms"): Scenario => ({
    name: `mentions list ${label}`,
    nfr,
    run: async (db) => {
      // Mirrors MentionsService.list: page (+ bounded count in parallel), then batch hydrate.
      const repo = new MentionsRepository(db);
      const s = resolveMentionsScope(MentionsListQuerySchema.parse({ ...r7, ...query }), pid, now);
      const [rows] = await Promise.all([
        repo.listPage(s.scope, s.q, s.sort, null, s.limit),
        s.count ? repo.count(s.scope, s.q) : Promise.resolve(undefined),
      ]);
      return repo.hydrate(rows.slice(0, s.limit).map((r) => r.post_id));
    },
  });

  const overviewNfr = "NFR-001 < 1500 ms";
  return [
    { name: "overview 24h", nfr: overviewNfr, run: (db) => analytics(db).overview.get(pid, aq(range(now, 1)), now) },
    { name: "overview 7d", nfr: overviewNfr, run: (db) => analytics(db).overview.get(pid, aq(r7), now) },
    { name: "overview 30d", nfr: overviewNfr, run: (db) => analytics(db).overview.get(pid, aq(r30), now) },
    {
      name: "overview 30d compare",
      nfr: overviewNfr,
      run: (db) => analytics(db).overview.get(pid, aq({ ...r30, compare: "true" }), now),
    },
    {
      name: "overview 30d intent=complaint",
      nfr: overviewNfr,
      run: (db) => analytics(db).overview.get(pid, aq({ ...r30, intent: "complaint" }), now),
    },
    {
      name: "overview 30d topic=ticket",
      nfr: overviewNfr,
      run: (db) => analytics(db).overview.get(pid, aq({ ...r30, topic: "ticket" }), now),
    },
    {
      name: "timeseries 30d day compare",
      nfr: overviewNfr,
      run: (db) =>
        analytics(db).ts.mentionsTimeseries(pid, TimeseriesQuerySchema.parse({ ...r30, compare: "true" }), now),
    },
    {
      name: "timeseries 48h hour",
      nfr: overviewNfr,
      run: (db) => analytics(db).ts.mentionsTimeseries(pid, TimeseriesQuerySchema.parse(range(now, 2)), now),
    },
    { name: "sentiment 30d", nfr: overviewNfr, run: (db) => analytics(db).dist.sentiment(pid, aq(r30)) },
    { name: "safety 30d", nfr: overviewNfr, run: (db) => analytics(db).dist.safety(pid, aq(r30)) },
    { name: "intents 30d", nfr: overviewNfr, run: (db) => analytics(db).dist.intents(pid, aq(r30)) },
    { name: "topics 30d", nfr: overviewNfr, run: (db) => analytics(db).dist.topics(pid, aq(r30)) },
    { name: "languages 30d", nfr: overviewNfr, run: (db) => analytics(db).dist.languages(pid, aq(r30)) },
    { name: "query-share 30d", nfr: overviewNfr, run: (db) => analytics(db).share.queryShare(pid, aq(r30)) },
    ...SORTS.map((sort) => list(`7d sort=${sort}`, { sort })),
    ...SORTS.map((sort) => list(`30d sort=${sort}`, { ...r30, sort })),
    list("7d newest count=true", { count: "true" }),
    list("30d newest count=true", { ...r30, count: "true" }),
    list("30d intent=complaint count=true", { ...r30, intent: "complaint", count: "true" }),
    list("30d topic=ticket count=true", { ...r30, topic: "ticket", count: "true" }),
    list("30d sentiment=negative count=true", { ...r30, sentiment: "negative", count: "true" }),
    list("30d q=concert (FTS) count=true", { ...r30, q: "concert", count: "true" }, "NFR-007 < 1500 ms"),
    list("120d relevance_desc count=true", { ...range(now, 120), sort: "relevance_desc", count: "true" }),
    {
      name: "mention detail",
      nfr: "NFR-003 < 700 ms",
      run: async (db) => {
        const repo = new MentionsRepository(db);
        const row = await repo.findDetail(pid, ctx.postId);
        return Promise.all([repo.listRuns(ctx.postId), repo.hydrate(row ? [row.post_id] : [])]);
      },
    },
    {
      name: "export 7d (throttle + cap+1 rows)",
      nfr: "FR-181 (no NFR; 30 s tx)",
      run: (db) => {
        const repo = new MentionsRepository(db);
        const s = resolveFilterScope(MentionsExportQuerySchema.parse(r7), pid, now);
        // Read-only replica of ExportService's tx (no audit insert, so throttle never trips).
        return repo.transaction(async (tx) => {
          await new ExportThrottle().assertAllowed(tx, ctx.actorUserId);
          return repo.listPage(s.scope, s.q, s.sort, null, ctx.exportCap, tx);
        });
      },
    },
  ];
}
