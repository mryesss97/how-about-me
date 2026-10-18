import { Suspense } from "react";
import { ListeningQueriesView } from "@/features/listening-queries/listening-queries-view";

export const metadata = { title: "Truy vấn theo dõi" };

/** Listening Queries — UX §3.5 (T-046). Suspense: the view reads `?deleted=1` via useSearchParams. */
export default function ListeningQueriesPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 lg:px-8">
      <Suspense fallback={null}>
        <ListeningQueriesView />
      </Suspense>
    </div>
  );
}
