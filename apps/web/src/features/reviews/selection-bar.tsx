"use client";

import { MARK_REVIEWED_MAX } from "@how-about-me/contracts";
import { Button } from "@/components/base/buttons/button";
import { formatCount } from "@/lib/format/number";

/**
 * Sticky selection bar (#339, UX §3.8): shown only while ≥ 1 item is selected, replacing the idle "(0)" button.
 * White enamel panel with a 2px navy rule (DESIGN.md "Reviews").
 */
export function SelectionBar({
  count,
  full,
  isPending,
  onClear,
  onMark,
}: {
  count: number;
  full: boolean;
  isPending: boolean;
  onClear: () => void;
  onMark: () => void;
}) {
  return (
    <div
      role="region"
      aria-label="Mục đã chọn"
      className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t-2 border-[var(--ink)] bg-[var(--enamel-white)] px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:mx-0 md:pb-3"
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span aria-live="polite" className="font-semibold text-primary tabular-nums">
          {formatCount(count)} mục đã chọn
        </span>
        <span aria-hidden className="text-tertiary">
          ·
        </span>
        <Button color="link-gray" size="sm" className="min-h-11 md:min-h-0" onClick={onClear}>
          Bỏ chọn
        </Button>
        {full ? <span className="text-tertiary">Tối đa {MARK_REVIEWED_MAX} mục mỗi lần</span> : null}
      </div>
      <Button size="sm" className="min-h-11 md:min-h-0" isDisabled={isPending} isLoading={isPending} onClick={onMark}>
        {`Đánh dấu đã xem lại (${formatCount(count)})`}
      </Button>
    </div>
  );
}
