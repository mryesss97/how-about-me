import { Suspense } from "react";
import { FilterBar } from "@/features/analytics/filter-bar";
import { MentionsView } from "@/features/mentions/mentions-view";
import { PageHeader } from "@/features/shared/page-header";
import { PageFrame } from "@/features/shared/page-frame";

export const metadata = { title: "Bài nhắc" };

/** Mentions Explorer — UX §3.3 (T-103). "Truy vấn" options load inside `FilterBar` (#329). */
export default function MentionsPage() {
  return (
    <PageFrame>
      <PageHeader title="Bài nhắc" />
      <Suspense fallback={null}>
        <FilterBar mentions />
        <MentionsView />
      </Suspense>
    </PageFrame>
  );
}
