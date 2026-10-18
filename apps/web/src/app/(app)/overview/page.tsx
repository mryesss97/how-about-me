import { Suspense } from "react";
import { OverviewFreshness } from "@/features/analytics/overview-freshness";
import { OverviewView } from "@/features/analytics/overview-view";
import { PageHeader } from "@/features/shared/page-header";
import { PageFrame } from "@/features/shared/page-frame";
export const metadata = { title: "Tổng quan" };
/** docs/01-product/09-ux-specification.md §3.2. Charts (T-100/T-101) and compare/drill-down (T-102) follow. */
export default function OverviewPage() {
  return (
    <PageFrame>
      <PageHeader
        title="Tổng quan"
        meta={
          <Suspense fallback={null}>
            <OverviewFreshness />
          </Suspense>
        }
      />
      {/* nuqs reads search params on the client, so the view needs a Suspense boundary. */}
      <Suspense fallback={null}>
        <OverviewView />
      </Suspense>
    </PageFrame>
  );
}
