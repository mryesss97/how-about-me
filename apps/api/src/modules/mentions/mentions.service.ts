import { Injectable } from "@nestjs/common";
import type { MentionsListQuery, MentionsPage, ReanalyzeResponse } from "@how-about-me/contracts";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { AppError } from "../../common/errors/app.error";
import { decodeSortCursor, encodeSortCursor } from "../../common/pagination/cursor";
import { AnalysisService } from "../analysis/analysis.service";
import { AuditService } from "../audit/audit.service";
import { MENTION_SORT_SPECS, resolveMentionsScope } from "./mentions-query";
import { toMentionListItem } from "./mentions.mapper";
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
  ) {}

  /**
   * FR-150/152/153/161: keyset-paginated list over base set B (BR-002, BR-016, BR-025).
   * `count=true` counts the whole filtered set (ignores cursor); omitted when the bounded count times out.
   */
  async list(projectId: string, query: MentionsListQuery, now: Date = new Date()): Promise<MentionsPage> {
    const s = resolveMentionsScope(query, projectId, now);
    const arity = MENTION_SORT_SPECS[s.sort].length;
    const cursor = decodeSortCursor(s.cursor, { sort: s.sort, arity });
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
          metadata: { runId: res.runId, effectiveVersion: this.analysis.effectiveVersion },
          requestId,
        },
        tx,
      );
      return { runId: res.runId, status: "pending" };
    });
  }
}
