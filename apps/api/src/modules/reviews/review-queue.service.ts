import type {
  MarkReviewedBody,
  MarkReviewedResponse,
  ReviewQueuePage,
  ReviewQueueQuery,
} from "@how-about-me/contracts";
import { Injectable } from "@nestjs/common";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { AppError } from "../../common/errors/app.error";
import { decodeSortCursor, encodeSortCursor } from "../../common/pagination/cursor";
import { isUtcMicrosKey } from "../../common/pagination/created-at-keyset";
import { AuditService } from "../audit/audit.service";
import { OverridesRepository } from "./overrides.repository";
import { toReviewQueueItem } from "./review-queue.mapper";
import { REVIEW_SORT, type ReviewCursor, ReviewQueueRepository } from "./review-queue.repository";

/** Tampered / other-sort / wrong-typed cursor → 400 VALIDATION_ERROR (#195), never a PG cast error. */
export function decodeReviewCursor(raw: string | undefined): ReviewCursor | null {
  const c = decodeSortCursor(raw, { sort: REVIEW_SORT, arity: 1 });
  if (!c) return null;
  const key = c.keys[0];
  if (!isUtcMicrosKey(key)) throw new AppError("VALIDATION_ERROR", "Invalid cursor", { path: "cursor" });
  return { key, id: c.id };
}

/** Review queue — T-144, FR-195, BR-040; audit `review.marked` (FR-200). */
@Injectable()
export class ReviewQueueService {
  constructor(
    private readonly repo: ReviewQueueRepository,
    private readonly users: OverridesRepository,
    private readonly audit: AuditService,
    @InjectPinoLogger(ReviewQueueService.name) private readonly logger: PinoLogger,
  ) {}

  /** Keyset page; `count=true` adds tab counts (+ totalCount for the requested tab), omitted on timeout. */
  async list(projectId: string, query: ReviewQueueQuery): Promise<ReviewQueuePage> {
    const cursor = decodeReviewCursor(query.cursor);
    const filter = { reason: query.reason, status: query.status };
    const [rows, counts] = await Promise.all([
      this.repo.listPage(projectId, filter, cursor, query.limit),
      query.count ? this.repo.counts(projectId, query.status) : Promise.resolve(undefined),
    ]);
    const page = rows.slice(0, query.limit);
    const last = page[page.length - 1];
    const nextCursor =
      rows.length > query.limit && last
        ? encodeSortCursor({ sort: REVIEW_SORT, keys: [last.k0], id: last.post_id })
        : null;
    const users = await this.users.usersById(page.flatMap((r) => (r.reviewed_by ? [r.reviewed_by] : [])));
    const items = page.map((r) => toReviewQueueItem(r, users));
    if (counts === null) {
      this.logger.warn({ projectId, event: "reviews.count_timeout" }, "review queue count timed out");
    }
    if (!counts) return { items, nextCursor };
    const totalCount =
      query.reason === "uncertain"
        ? counts.uncertain
        : query.reason === "low_confidence"
          ? counts.lowConfidence
          : query.reason === "failed"
            ? counts.failed
            : counts.all;
    return { items, nextCursor, totalCount, counts };
  }

  /** Idempotent; ids outside the project are skipped. One transaction: update + audit (skipped when 0 marked). */
  markReviewed(
    projectId: string,
    body: MarkReviewedBody,
    actorUserId: string,
    requestId: string | null,
  ): Promise<MarkReviewedResponse> {
    const postIds = [...new Set(body.postIds)];
    return this.repo.transaction(async (tx) => {
      const marked = await this.repo.markReviewed(tx, projectId, postIds, actorUserId);
      if (marked.length > 0) {
        // FR-200: ids and count only, never post text.
        await this.audit.record(
          {
            projectId,
            actorUserId,
            action: "review.marked",
            entityType: "monitoring_project",
            entityId: projectId,
            metadata: { count: marked.length, postIds: marked },
            requestId,
          },
          tx,
        );
      }
      return { marked: marked.length };
    });
  }
}
