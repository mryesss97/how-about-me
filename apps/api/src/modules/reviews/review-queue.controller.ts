import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  type MarkReviewedBody,
  MarkReviewedBodySchema,
  type MarkReviewedResponse,
  type ReviewQueuePage,
  type ReviewQueueQuery,
  ReviewQueueQuerySchema,
} from "@how-about-me/contracts";
import { type AuthedRequest, type AuthUser, CurrentUser } from "../../common/auth/current-user.decorator";
import { Roles } from "../../common/auth/roles.decorator";
import { zod } from "../../common/pipes/zod-validation.pipe";
import { ReviewQueueService } from "./review-queue.service";

/** docs/02-architecture/05-api-contract.md "Reviews" — T-144, FR-195; GET any member, mark admin · analyst (FR-015). */
@ApiTags("reviews")
@ApiBearerAuth()
@Controller("projects/:projectId/reviews")
export class ReviewQueueController {
  constructor(private readonly reviews: ReviewQueueService) {}

  @Get()
  list(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query(zod(ReviewQueueQuerySchema)) query: ReviewQueueQuery,
  ): Promise<ReviewQueuePage> {
    return this.reviews.list(projectId, query);
  }

  @Post("mark-reviewed")
  @HttpCode(200)
  @Roles("admin", "analyst")
  markReviewed(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body(zod(MarkReviewedBodySchema)) body: MarkReviewedBody,
    @CurrentUser() user: AuthUser,
    @Req() req: AuthedRequest,
  ): Promise<MarkReviewedResponse> {
    return this.reviews.markReviewed(projectId, body, user.id, req.id ?? null);
  }
}
