"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/base/buttons/button";
import type { EmptyReason } from "@/features/shared/overview-banners";
import { formatCount } from "@/lib/format/number";

type EmptyCopy = { title: string; description: string; action: ReactNode };

const linkClass = "text-sm font-semibold text-secondary underline underline-offset-2";

/** FR-159 / BR-032: the Mentions empty state names its cause instead of one generic "no data" box. */
export function mentionsEmptyCopy(opts: {
  reason: EmptyReason;
  pendingCount: number;
  canManage: boolean;
  onWidenRange: () => void;
  /** #328: pending link keeping the current range/queries. */
  pendingHref?: string;
}): EmptyCopy {
  const widen = (
    <Button color="secondary" size="sm" onClick={opts.onWidenRange}>
      Mở rộng khoảng thời gian
    </Button>
  );
  switch (opts.reason) {
    case "integration":
      return {
        title: "Kết nối Threads cần được kiểm tra.",
        description: "Bài nhắc mới sẽ không được thu thập cho tới khi kết nối hoạt động lại.",
        // Link visibility is UX only; the API enforces access (BR-033).
        action: opts.canManage ? (
          <Link href="/settings/integrations" className={linkClass}>
            Mở cài đặt kết nối
          </Link>
        ) : null,
      };
    case "sync":
      return {
        title: "Lần đồng bộ Threads gần nhất bị lỗi, dữ liệu có thể chưa đầy đủ.",
        description: "Danh sách rỗng có thể do dữ liệu chưa được đồng bộ, không hẳn là không có bài nhắc.",
        action: (
          <Link href="/system-status" className={linkClass}>
            Xem trạng thái hệ thống
          </Link>
        ),
      };
    case "pending":
      return {
        title: `${formatCount(opts.pendingCount)} bài nhắc đang chờ phân tích.`,
        description: "Bài nhắc chưa phân tích có thể bị bộ lọc cảm xúc/chủ đề loại ra cho tới khi phân tích xong.",
        action: (
          <Link href={opts.pendingHref ?? "/mentions?analysisStatus=pending,processing"} className={linkClass}>
            Xem bài nhắc đang chờ
          </Link>
        ),
      };
    default:
      return {
        title: "Không có bài nhắc liên quan trong khoảng thời gian này.",
        description: "Hãy mở rộng khoảng thời gian hoặc bỏ bớt bộ lọc.",
        action: widen,
      };
  }
}
