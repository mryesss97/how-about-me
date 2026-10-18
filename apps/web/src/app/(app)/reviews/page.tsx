import { Suspense } from "react";
import { ReviewsRouteView } from "./reviews-route-view";
import { PageHeader } from "@/features/shared/page-header";
import { PageFrame } from "@/features/shared/page-frame";

export const metadata = { title: "Cần xem lại" };

/** Review queue — UX §3.8 (FR-195, #219). Open to every role; actions are admin/analyst only. */
export default function ReviewsPage() {
  return (
    <PageFrame>
      <PageHeader
        title="Cần xem lại"
        description="Các phân tích chưa chắc chắn, độ tin cậy thấp hoặc bị lỗi, đang chờ người kiểm tra."
      />
      <Suspense fallback={null}>
        <ReviewsRouteView />
      </Suspense>
    </PageFrame>
  );
}
