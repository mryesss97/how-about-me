"use client";

import { ArrowLeft } from "@untitledui/icons";
import { useRouter } from "next/navigation";
import { PlaqueButton } from "./plaque-button";

/**
 * 404 actions (#286, #350): "Quay lại" goes back, or to `/` when there is no history
 * (link opened in a new tab: `history.length <= 1`). "Về trang chủ" always links to `/`.
 */
export function NotFoundActions() {
  const router = useRouter();
  const goBack = () => (window.history.length <= 1 ? router.push("/") : router.back());
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <PlaqueButton size="md" fullWidthOnMobile iconLeading={ArrowLeft} onClick={goBack}>
        Quay lại
      </PlaqueButton>
      <PlaqueButton size="md" fullWidthOnMobile href="/">
        Về trang chủ
      </PlaqueButton>
    </div>
  );
}
