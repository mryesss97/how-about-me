"use client";

import { ArrowLeft } from "@untitledui/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";

const PLAQUE = "plaque-button inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 sm:w-auto";

/** 404 actions (#286): "Về trang chủ" links to `/` (previously called router.back()). */
export function NotFoundActions() {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <button type="button" className={PLAQUE} onClick={() => router.back()}>
        <ArrowLeft aria-hidden className="size-5" />
        Quay lại
      </button>
      <Link href="/" className={PLAQUE}>
        Về trang chủ
      </Link>
    </div>
  );
}
