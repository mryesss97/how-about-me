"use client";

import { ChevronDown } from "@untitledui/icons";
import { useId, useState, type ReactNode } from "react";
import { cx } from "@/utils/cx";

/** Collapsed-by-default section ("Chi tiết kỹ thuật", "Thông tin bài") — #338; content only mounts when open. */
export function Disclosure({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex w-fit items-center gap-1 rounded-sm max-md:min-h-11 text-sm font-semibold text-brand-secondary outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {label}
        <ChevronDown className={cx("size-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div id={id} className="flex flex-col gap-4">
          {children}
        </div>
      ) : null}
    </div>
  );
}
