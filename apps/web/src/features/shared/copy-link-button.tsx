"use client";

import { Link01 } from "@untitledui/icons";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { notifyError } from "@/lib/toast";
import { pinRange, rangeLabel, toShareUrl } from "@/lib/filters";
import { useFilters } from "@/lib/filters/use-filters";
import { PlaqueButton } from "./plaque-button";

interface CopyLinkButtonProps {
  /** Range already pinned by the view (Mentions list) so the link matches the visible set exactly. */
  range?: { from: string; to: string };
  /** Icon-only (mobile summary strip); keeps the accessible name. */
  compact?: boolean;
}

/** #349 "Sao chép liên kết": copies an absolute URL with the range pinned as `custom` (FR-142, FR-130). */
export function CopyLinkButton({ range, compact = false }: CopyLinkButtonProps) {
  const { filters } = useFilters();
  const pathname = usePathname();

  const onCopy = async () => {
    // Resolved on click (not render) to avoid hydration mismatch and to use the current origin.
    const now = new Date();
    const url = toShareUrl(pathname, filters, { origin: window.location.origin, now, range });
    // Relative presets keep their own label (hours for 1h/24h); an injected range is labelled as pinned.
    const period = (range ? rangeLabel(pinRange(filters, now, range), now) : rangeLabel(filters, now)).replace(
      " – ",
      "–",
    );
    try {
      await navigator.clipboard.writeText(url);
      toast.success(`Đã sao chép liên kết · ${period}`);
    } catch {
      notifyError("Không sao chép được. Hãy sao chép từ thanh địa chỉ.");
    }
  };

  return (
    <PlaqueButton
      iconLeading={Link01}
      onClick={() => void onCopy()}
      aria-label={compact ? "Sao chép liên kết" : undefined}
      className={compact ? "min-h-11 min-w-11 shrink-0 justify-center" : "max-md:min-h-11"}
    >
      {compact ? null : "Sao chép liên kết"}
    </PlaqueButton>
  );
}
