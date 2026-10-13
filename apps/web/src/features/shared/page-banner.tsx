"use client";

import type { ReactNode } from "react";
import { AlertCircle, AlertTriangle, InfoCircle } from "@untitledui/icons";
import { cx } from "@/utils/cx";

/**
 * Page-level banners — docs/01-product/09-ux-specification.md §2.3.
 *
 * These are the "your numbers may be wrong, and here is why" messages. They sit above the content
 * rather than inside a widget because they qualify *every* number on the page: a failed sync or a queue
 * of unanalysed mentions changes how the whole dashboard should be read (BR-032).
 */

export type BannerTone = "warning" | "info" | "error";

type ToneSpec = { container: string; icon: string; Icon: typeof AlertTriangle; role: "alert" | "status" };

/**
 * Uses the same `utility-*` palette as the semantic badges rather than the solid `bg-*-primary`
 * surfaces: a full-width solid block drowns the page, and the tinted surfaces keep AA contrast for the
 * body copy in both light and dark themes (NFR-035).
 */
const TONES: Record<BannerTone, ToneSpec> = {
  warning: {
    container: "border-utility-yellow-200 bg-utility-yellow-50",
    icon: "text-utility-yellow-500",
    Icon: AlertTriangle,
    role: "status",
  },
  info: {
    container: "border-utility-blue-200 bg-utility-blue-50",
    icon: "text-utility-blue-500",
    Icon: InfoCircle,
    role: "status",
  },
  error: {
    container: "border-utility-red-200 bg-utility-red-50",
    icon: "text-utility-red-500",
    Icon: AlertCircle,
    role: "alert",
  },
};

export function PageBanner({
  tone,
  title,
  description,
  action,
  className,
}: {
  tone: BannerTone;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  const { container, icon, Icon, role } = TONES[tone];
  return (
    <div
      role={role}
      className={cx("flex flex-wrap items-start gap-3 rounded-xl border px-4 py-3", container, className)}
    >
      <Icon aria-hidden="true" className={cx("mt-0.5 size-5 shrink-0", icon)} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm font-semibold text-primary">{title}</p>
        {description ? <p className="text-sm text-tertiary">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Shown whenever the latest sync for any enabled query failed — totals in range may be short (FR-081). */
export function SyncFailedBanner({ href = "/system-status" }: { href?: string }) {
  return (
    <PageBanner
      tone="warning"
      title="Latest Threads sync failed. Data may be incomplete."
      action={
        <a href={href} className="text-sm font-semibold text-secondary underline underline-offset-2">
          View System Status
        </a>
      }
    />
  );
}

/** Count comes from the coverage block, so "waiting" never gets confused with "analysed as neutral". */
export function AnalysisPendingBanner({
  count,
  href = "/mentions?analysisStatus=pending",
}: {
  count: number;
  href?: string;
}) {
  if (count <= 0) return null;
  return (
    <PageBanner
      tone="info"
      title={`${count.toLocaleString()} ${count === 1 ? "mention is" : "mentions are"} waiting for analysis.`}
      description="Rates below only count mentions whose analysis has completed."
      action={
        <a href={href} className="text-sm font-semibold text-secondary underline underline-offset-2">
          View pending
        </a>
      }
    />
  );
}

/** Admins get the link to fix it; everyone else only gets told why collection stopped (BR-033). */
export function IntegrationExpiredBanner({ canManage = false }: { canManage?: boolean }) {
  return (
    <PageBanner
      tone="error"
      title="Threads connection needs attention."
      description={
        canManage
          ? "Collection is paused until the access token is updated."
          : "Collection is paused. Ask a project admin to update the Threads access token."
      }
      action={
        canManage ? (
          <a
            href="/settings/integrations"
            className="text-sm font-semibold text-secondary underline underline-offset-2"
          >
            Go to Integrations
          </a>
        ) : null
      }
    />
  );
}
