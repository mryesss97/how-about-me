import { Suspense } from "react";
import { FilterBar } from "@/features/analytics/filter-bar";
import { MentionsView } from "@/features/mentions/mentions-view";
import { PageHeader } from "@/features/shared/page-header";

export const metadata = { title: "Bài nhắc" };

/** Mentions Explorer — UX §3.3 (T-103). "Truy vấn" options load inside `FilterBar` (#329). */
export default function MentionsPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 lg:px-8">
      <PageHeader title="Bài nhắc" />
      <Suspense fallback={null}>
        <FilterBar />
        <MentionsView />
      </Suspense>
    </div>
  );
}
