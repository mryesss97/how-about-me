import { Suspense } from "react";
import { ListeningQueriesView } from "@/features/listening-queries/listening-queries-view";
import { PageFrame } from "@/features/shared/page-frame";

export const metadata = { title: "Truy vấn theo dõi" };

/** Listening Queries — UX §3.5 (T-046). Suspense: the view reads `?deleted=1` via useSearchParams. */
export default function ListeningQueriesPage() {
  return (
    <PageFrame>
      <Suspense fallback={null}>
        <ListeningQueriesView />
      </Suspense>
    </PageFrame>
  );
}
