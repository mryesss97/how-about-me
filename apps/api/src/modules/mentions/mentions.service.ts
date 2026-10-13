import { Injectable } from "@nestjs/common";
import type { ReanalyzeResponse } from "@how-about-me/contracts";
import { AppError } from "../../common/errors/app.error";
import { AnalysisService } from "../analysis/analysis.service";
import { AuditService } from "../audit/audit.service";
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
  ) {}

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
