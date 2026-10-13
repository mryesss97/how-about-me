"use client";

import { MentionDetail } from "@/features/mentions/detail/mention-detail";
import { ReviewsView } from "@/features/reviews/reviews-view";

/**
 * Client-side composition for /reviews (#233): the route injects the Mentions detail body so `features/reviews`
 * never imports `features/mentions`. A client file because a render function can't cross the server boundary.
 */
export function ReviewsRouteView() {
  return <ReviewsView renderDetail={(postId) => <MentionDetail mentionId={postId} variant="slideout" />} />;
}
