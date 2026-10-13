import { Suspense } from "react";
import { ReviewsRouteView } from "./reviews-route-view";

export const metadata = { title: "Reviews" };

/** Review queue — UX §3.8 (FR-195, #219). Open to every role; actions are admin/analyst only. */
export default function ReviewsPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 lg:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-display-xs font-semibold text-primary">Reviews</h1>
        <p className="text-sm text-tertiary">
          Uncertain, low-confidence and failed analyses waiting for a human check.
        </p>
      </header>
      <Suspense fallback={null}>
        <ReviewsRouteView />
      </Suspense>
    </div>
  );
}
