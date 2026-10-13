import { Inject, Injectable } from "@nestjs/common";
import type {
  BulkReanalyzeBody,
  BulkReanalyzeResponse,
  MentionDetail,
  MentionsListQuery,
  MentionsPage,
  ReanalyzeResponse,
} from "@how-about-me/contracts";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { AppError } from "../../common/errors/app.error";
import { encodeSortCursor } from "../../common/pagination/cursor";
import { APP_CONFIG, type AppConfig } from "../../config/config.module";
import { BULK_TX_TIMEOUT_MS } from "../analysis/analysis-runs.service";
import { AnalysisService } from "../analysis/analysis.service";
import { BULK_REANALYZE_AUDIT_ACTION, BulkReanalyzeThrottle } from "../analysis/bulk-reanalyze-throttle";
import { AuditService } from "../audit/audit.service";
import { decodeMentionCursor, resolveFilterScope, resolveMentionsScope } from "./mentions-query";
import { toMentionDetail, toMentionListItem } from "./mentions.mapper";
import { MentionsRepository } from "./mentions.repository";

const alreadyPending = () =>
  new AppError("ANALYSIS_ALREADY_PENDING", "An analysis run is already pending or processing for this mention");

/** Mentions use cases — docs/02-architecture/05-api-contract.md §7. */
@Injectable()
export class MentionsService {
  constructor(
    private readonly repo: MentionsRepository,
    private readonly analysis: AnalysisService,
    private readonly audit: AuditService,
    @InjectPinoLogger(MentionsService.name) private readonly logger: PinoLogger,
    private readonly throttle: BulkReanalyzeThrottle,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
  ) {}

  /**
   * FR-150/152/153/161: keyset-paginated list over base set B (BR-002, BR-016, BR-025).
   * `count=true` counts the whole filtered set (ignores cursor); omitted when the bounded count times out.
   */
  async list(projectId: string, query: MentionsListQuery, now: Date = new Date()): Promise<MentionsPage> {
    const s = resolveMentionsScope(query, projectId, now);
    const cursor = decodeMentionCursor(s.cursor, s.sort);
    const [rows, total] = await Promise.all([
      this.repo.listPage(s.scope, s.q, s.sort, cursor, s.limit),
      s.count ? this.repo.count(s.scope, s.q) : Promise.resolve(undefined),
    ]);
    const page = rows.slice(0, s.limit);
    const last = page[page.length - 1];
    const nextCursor =
      rows.length > s.limit && last ? encodeSortCursor({ sort: s.sort, keys: last.keys, id: last.post_id }) : null;
    const hydrated = await this.repo.hydrate(
      page.map((r) => r.post_id),
      page.flatMap((r) => (r.analysis_id ? [r.analysis_id] : [])),
    );
    const items = page.map((r) => toMentionListItem(r, hydrated));
    if (total === null) {
      // No q / post text in logs (FR-200).
      this.logger.warn({ projectId, event: "mentions.count_timeout" }, "mentions count timed out");
    }
    return total == null ? { items, nextCursor } : { items, nextCursor, totalCount: total };
  }

  /**
   * T-096 / FR-154: mention detail — source, matches (BR-010), effective analysis (BR-025) with scores and
   * versions, run history (BR-003). No base-set filter; another project's post → 404.
   */
  async detail(projectId: string, mentionId: string): Promise<MentionDetail> {
    const row = await this.repo.findDetail(projectId, mentionId);
    if (!row) throw AppError.notFound("Mention");
    const [hydrated, runs] = await Promise.all([
      this.repo.hydrate([row.post_id], row.analysis_id ? [row.analysis_id] : []),
      this.repo.listRuns(row.post_id),
    ]);
    return toMentionDetail(row, hydrated, runs);
  }

  /**
   * FR-115: manual re-analysis of one mention. `trigger=manual` is a force trigger, so it bypasses the
   * completed-run dedupe (FR-116); previous runs are kept (BR-003). 409 when the post has any open run;
   * the partial unique index (BR-024) still decides concurrent requests — the loser also gets 409.
   */
  reanalyze(
    projectId: string,
    mentionId: string,
    actorUserId: string,
    requestId: string | null,
  ): Promise<ReanalyzeResponse> {
    return this.repo.transaction(async (tx) => {
      const post = await this.repo.findInProject(tx, projectId, mentionId);
      if (!post) throw AppError.notFound("Mention");
      if (await this.repo.hasOpenRun(tx, post.id)) throw alreadyPending();
      const res = await this.analysis.enqueueDetailed(tx, {
        postId: post.id,
        projectId,
        contentHash: post.contentHash,
        revision: post.revision,
        trigger: "manual",
        requestedBy: actorUserId,
      });
      if (!res.created) throw alreadyPending();
      // FR-200: no post text in audit metadata.
      await this.audit.record(
        {
          projectId,
          actorUserId,
          action: "analysis.reanalyze_requested",
          entityType: "social_post",
          entityId: post.id,
          metadata: { runId: res.runId, effectiveVersion: res.effectiveVersion },
          requestId,
        },
        tx,
      );
      return { runId: res.runId, status: "pending" };
    });
  }

  /**
   * FR-196 / T-145: bulk re-analysis over the list filters (base set B, BR-002, default `relevant` BR-016).
   * dryRun only counts — no throttle, no enqueue, no audit (TC-REV-008). Otherwise: throttle 1/5 min/project
   * (NFR-017), enqueue up to `ANALYSIS_BULK_MAX` posts in `sort` order with `trigger=bulk` (not a force trigger,
   * so BR-024 dedupe holds), keep old runs (BR-003) and audit in the same tx — also when nothing was enqueued.
   */
  async bulkReanalyze(
    projectId: string,
    body: BulkReanalyzeBody,
    actorUserId: string,
    requestId: string | null,
    now: Date = new Date(),
  ): Promise<BulkReanalyzeResponse> {
    const cap = this.cfg.ANALYSIS_BULK_MAX;
    const { dryRun, ...filters } = body;
    const s = resolveFilterScope(filters, projectId, now);
    if (dryRun) return { matched: await this.repo.countMatched(s.scope, s.q), enqueued: 0, cap };
    return this.repo.transaction(
      async (tx) => {
        await this.throttle.assertAllowed(tx, projectId);
        const matched = await this.repo.countMatched(s.scope, s.q, tx);
        const ev = await this.analysis.effectiveVersionFor(projectId, tx);
        const candidates = await this.repo.selectBulkCandidates(tx, s.scope, s.q, s.sort, ev, cap);
        const res = await this.analysis.enqueueMany(tx, {
          projectId,
          posts: candidates.map((c) => ({ postId: c.id, contentHash: c.contentHash, revision: c.revision })),
          trigger: "bulk",
          requestedBy: actorUserId,
        });
        const enqueued = res.postIds.length;
        // FR-200: filters only, never post ids/text.
        await this.audit.record(
          {
            projectId,
            actorUserId,
            action: BULK_REANALYZE_AUDIT_ACTION,
            entityType: "monitoring_project",
            entityId: projectId,
            metadata: {
              scope: "filters",
              filters,
              counts: { matched, enqueued, cap },
              effectiveVersion: res.effectiveVersion,
            },
            requestId,
          },
          tx,
        );
        return { matched, enqueued, cap };
      },
      { timeout: BULK_TX_TIMEOUT_MS },
    );
  }
}
