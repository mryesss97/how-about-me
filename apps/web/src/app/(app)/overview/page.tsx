import { Suspense } from "react";
import { OverviewView } from "@/features/analytics/overview-view";
export const metadata = { title: "Overview" };
/** docs/01-product/09-ux-specification.md §3.2. Charts (T-100/T-101) and compare/drill-down (T-102) follow. */
export default function OverviewPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 lg:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-display-xs font-semibold text-primary">Overview</h1>
      </header>
      {/* nuqs reads search params on the client, so the view needs a Suspense boundary. */}
      <Suspense fallback={null}>
        <OverviewView />
      </Suspense>
    </div>
  );
}
