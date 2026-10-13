"use client";

import type { OverviewResponse } from "@how-about-me/contracts";
import { AnalysisPendingBanner, IntegrationExpiredBanner, SyncFailedBanner } from "@/features/shared/page-banner";

type BannerInput = Pick<OverviewResponse, "coverage" | "dataQuality">;
export type OverviewBannerKind = "integration" | "sync" | "pending";

/** FR-134: which banners apply, ordered red → yellow → blue. Each state stays distinct (BR-032). */
export function bannersFor({ coverage, dataQuality }: BannerInput): OverviewBannerKind[] {
  const out: OverviewBannerKind[] = [];
  if (dataQuality.integrationStatus !== "connected") out.push("integration");
  // `partial` is degraded too (doc 07 §2), so it shares the sync-failed banner.
  if (dataQuality.lastSyncStatus === "failed" || dataQuality.lastSyncStatus === "partial") out.push("sync");
  if (coverage.pendingMentions > 0) out.push("pending");
  return out;
}

/** `canManage` only toggles the Integrations link — UX only, the API enforces access (BR-033). */
export function OverviewBanners({ data, canManage }: { data: BannerInput; canManage: boolean }) {
  const kinds = bannersFor(data);
  if (kinds.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {kinds.map((k) =>
        k === "integration" ? (
          <IntegrationExpiredBanner key={k} canManage={canManage} />
        ) : k === "sync" ? (
          <SyncFailedBanner key={k} />
        ) : (
          <AnalysisPendingBanner key={k} count={data.coverage.pendingMentions} />
        ),
      )}
    </div>
  );
}
