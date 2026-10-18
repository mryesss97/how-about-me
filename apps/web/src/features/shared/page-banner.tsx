"use client";

import type { ReactNode } from "react";
import { AlertCircle, AlertTriangle, InfoCircle } from "@untitledui/icons";
import Link from "next/link";
import { cx } from "@/utils/cx";
import { plaqueClassName } from "@/features/shared/plaque-button";
import { formatCount } from "@/lib/format/number";

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
 * #336: a flat white enamel board (3px corners, like `.operate-board`) with a 2px left rule in the tone colour.
 * Body copy stays on `bg-primary`, so AA contrast holds in both themes (NFR-035); the tone is carried by the
 * icon + rule + title text together, never by colour alone (BR-017).
 */
const TONES: Record<BannerTone, ToneSpec> = {
  warning: {
    container: "border-l-utility-yellow-500",
    icon: "text-utility-yellow-500",
    Icon: AlertTriangle,
    role: "status",
  },
  info: {
    container: "border-l-utility-blue-500",
    icon: "text-utility-blue-500",
    Icon: InfoCircle,
    role: "status",
  },
  error: {
    container: "border-l-utility-red-500",
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
  compact = false,
  live = true,
}: {
  tone: BannerTone;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  /** #345: shell strip — tighter padding, title + description on one line from sm. */
  compact?: boolean;
  /** #345: false → no live-region role (the shell strip must not be re-announced on every navigation). */
  live?: boolean;
}) {
  const { container, icon, Icon, role } = TONES[tone];
  return (
    <div
      role={live ? role : undefined}
      className={cx(
        "flex flex-wrap items-start gap-3 rounded-[3px] border border-l-2 border-secondary bg-primary px-4",
        compact ? "py-2" : "py-3",
        container,
        className,
      )}
    >
      <Icon aria-hidden="true" className={cx("mt-0.5 size-5 shrink-0", icon)} />
      <div className={cx("flex min-w-0 flex-1 flex-col gap-0.5", compact && "sm:flex-row sm:flex-wrap sm:gap-x-2")}>
        <p className="text-sm font-semibold text-primary">{title}</p>
        {description ? <p className="text-sm text-tertiary">{description}</p> : null}
      </div>
      {/* Under sm the action wraps below the text, indented past the icon. */}
      {action ? <div className="basis-full ps-8 sm:ms-auto sm:basis-auto sm:ps-0">{action}</div> : null}
    </div>
  );
}

/** #336: banner actions are plaque links (next/link), 44px tall under sm. */
export function BannerLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={plaqueClassName("sm", "min-h-11 sm:min-h-0")}>
      {children}
    </Link>
  );
}

/** Shown whenever the latest sync for any enabled query failed — totals in range may be short (FR-081). Links straight
 * to the failed sync jobs (#342). */
export function SyncFailedBanner({ href = "/system-status?tab=sync-jobs&status=failed" }: { href?: string }) {
  return (
    <PageBanner
      tone="warning"
      title="Lần đồng bộ Threads gần nhất bị lỗi. Dữ liệu có thể chưa đầy đủ."
      action={<BannerLink href={href}>Xem lượt đồng bộ lỗi</BannerLink>}
    />
  );
}

/** Count comes from the coverage block, so "waiting" never gets confused with "analysed as neutral". */
export function AnalysisPendingBanner({
  count,
  href = "/mentions?analysisStatus=pending,processing",
}: {
  count: number;
  href?: string;
}) {
  if (count <= 0) return null;
  return (
    <PageBanner
      tone="info"
      title={`${formatCount(count)} bài nhắc đang chờ phân tích.`}
      description="Các tỷ lệ bên dưới chỉ tính bài nhắc đã phân tích xong."
      action={<BannerLink href={href}>Xem bài nhắc đang chờ</BannerLink>}
    />
  );
}

/** Admins get the link to fix it; everyone else only gets told why collection stopped (BR-033). */
export function IntegrationExpiredBanner({ canManage = false }: { canManage?: boolean }) {
  return (
    <PageBanner
      tone="error"
      title="Kết nối Threads cần được xử lý."
      description={
        canManage
          ? "Việc thu thập tạm dừng cho đến khi access token được cập nhật."
          : "Việc thu thập đang tạm dừng. Hãy nhờ quản trị dự án cập nhật access token Threads."
      }
      action={canManage ? <BannerLink href="/settings/integrations">Đến trang Kết nối</BannerLink> : null}
    />
  );
}
