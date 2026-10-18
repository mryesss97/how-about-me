"use client";

import { ArrowLeft } from "@untitledui/icons";
import { useRouter } from "next/navigation";
import { PlaqueButton } from "./plaque-button";

/** 404 actions (#286): "Về trang chủ" links to `/` (previously called router.back()). */
export function NotFoundActions() {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <PlaqueButton size="md" fullWidthOnMobile iconLeading={ArrowLeft} onClick={() => router.back()}>
        Quay lại
      </PlaqueButton>
      <PlaqueButton size="md" fullWidthOnMobile href="/">
        Về trang chủ
      </PlaqueButton>
    </div>
  );
}
