import { Suspense } from "react";
import { FilterBar } from "@/features/analytics/filter-bar";
import { PagePlaceholder } from "@/features/shared/page-placeholder";
export const metadata = { title: "Mentions" };
export default function MentionsPage() {
  return (
    <PagePlaceholder
      title="Mentions"
      description="Filterable, sortable list of stored Threads posts with semantic badges and detail slide-out (UX §3.3)."
      tasks={["T-103 list", "T-104 detail", "T-105 states"]}
    >
      <Suspense fallback={null}>
        <FilterBar queryOptions={[]} />
      </Suspense>
    </PagePlaceholder>
  );
}
