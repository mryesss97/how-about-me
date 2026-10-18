"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useCurrentProject } from "@/features/auth/use-current-project";
import { useRole } from "@/features/auth/use-role";
import { useHydrated } from "@/hooks/use-hydrated";
import { BannerLink, PageBanner } from "./page-banner";
import { collectionNotice, navHealth, type HealthNotice, type NavHealth } from "./collection-health";
import { useSystemStatus } from "./use-system-status";

type CollectionHealth = { notice: HealthNotice | null; nav: NavHealth | null };

const CollectionHealthContext = createContext<CollectionHealth | null>(null);

/**
 * #345 (flows-4): one system-status read for the whole shell (stale 60 s). Loading / error → nothing, so a
 * failing status call never blocks a page or raises a false alarm. Role-derived output waits for hydration (#361).
 */
export function CollectionHealthProvider({ children }: { children: ReactNode }) {
  const { project } = useCurrentProject();
  const { role } = useRole();
  const hydrated = useHydrated();
  const { data } = useSystemStatus(project?.id);
  const tz = project?.timezone;
  const value = useMemo<CollectionHealth | null>(() => {
    if (!hydrated || !data || !role) return null;
    const opts = { isAdmin: role === "admin", nowMs: Date.parse(data.generatedAt), timeZone: tz };
    return { notice: collectionNotice(data, opts), nav: navHealth(data, opts) };
  }, [hydrated, data, role, tz]);
  return <CollectionHealthContext.Provider value={value}>{children}</CollectionHealthContext.Provider>;
}

/** Null outside the provider (unit tests of single pages) or while unknown. */
export function useCollectionHealth(): CollectionHealth | null {
  return useContext(CollectionHealthContext);
}

/** These screens already state the same thing in more detail (#342 summary, #346 Threads card). */
const HIDDEN_ON = ["/system-status", "/settings/integrations"];

/** #345: the collection-health strip under every fascia. Not a live region; icon + title always (BR-017). */
export function HealthStrip() {
  const pathname = usePathname();
  const notice = useCollectionHealth()?.notice;
  if (!notice || HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  return (
    <section aria-label="Tình trạng thu thập">
      <PageBanner
        compact
        live={false}
        tone={notice.tone}
        title={notice.title}
        description={notice.description}
        action={notice.action ? <BannerLink href={notice.action.href}>{notice.action.label}</BannerLink> : null}
      />
    </section>
  );
}
