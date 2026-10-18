import type { Metadata } from "next";
import { BrandLogo } from "@/features/shared/brand-logo";
import { NotFoundActions } from "@/features/shared/not-found-actions";

export const metadata: Metadata = { title: "Không tìm thấy trang" };

/** 404 in signboard style (#286): wall + white enamel board, plaque actions. */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--wall)] px-4 py-10">
      <div className="operate-board relative w-full max-w-xl">
        <span aria-hidden className="sign-keyline" />
        <div className="relative flex flex-col gap-6 p-6 sm:p-10">
          <BrandLogo variant="stacked" className="h-20 w-auto" />
          <div className="flex flex-col gap-3">
            <span className="kpi-label">Lỗi 404</span>
            <h1 className="page-fascia-title">Không tìm thấy trang</h1>
            <p className="text-md text-tertiary">Trang bạn tìm không tồn tại hoặc đã được chuyển đi.</p>
          </div>
          <NotFoundActions />
        </div>
      </div>
    </main>
  );
}
