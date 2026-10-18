"use client";

import { useSyncExternalStore } from "react";
import { useCurrentProject } from "@/features/auth/use-current-project";
import { DEFAULT_TZ } from "@/lib/filters/parsers";
import { useFilters } from "@/lib/filters/use-filters";
import { syncFreshness } from "@/lib/format/sync-freshness";
import { useOverview } from "./api";

/**
 * #336: "Đồng bộ lần cuối …" in the /overview fascia. Same overview query (key) as banners + KPI → no extra request.
 * Renders nothing until data is on the client (time depends on `Date.now()`, so no SSR mismatch); re-renders every
 * 15 s and on every refetch.
 */
const TICK = 15_000;
const subscribeTick = (onChange: () => void) => {
  const id = setInterval(onChange, TICK);
  return () => clearInterval(id);
};
/** Client clock floored to 15 s (stable between ticks), null on the server → no hydration mismatch. */
const clockSnapshot = () => Math.floor(Date.now() / TICK) * TICK;
const serverSnapshot = () => null;

export function OverviewFreshness() {
  const { project } = useCurrentProject();
  const { apiParams } = useFilters("analytics");
  // A refetch hands back new `data`, which re-renders with the fresh lastSyncAt.
  const { data } = useOverview(project?.id, apiParams);
  const clock = useSyncExternalStore(subscribeTick, clockSnapshot, serverSnapshot);
  const now = clock === null ? null : new Date(clock);

  if (!data || !now) return <span aria-hidden className="block h-5" />;
  // #345: same rule as the landing "cập nhật" — a time only for a successful last sync.
  const fresh = syncFreshness(data.dataQuality, now, apiParams.timezone ?? DEFAULT_TZ);
  return (
    <p className="text-sm text-tertiary tabular-nums">{fresh.status ? fresh.text : `Đồng bộ lần cuối ${fresh.text}`}</p>
  );
}
