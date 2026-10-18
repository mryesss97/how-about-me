"use client";

import type { OverrideField } from "@how-about-me/contracts";
import { useId, type ReactNode } from "react";
import { Button } from "@/components/base/buttons/button";
import { cx } from "@/utils/cx";
import { FIELD_LABELS } from "./overrides";

/** Sub-group inside the "Phân tích" board: Inter h3 under the board's h2 (DESIGN "What stays Inter", #338). */
export function Group({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h3 id={id} className="text-sm font-semibold text-secondary">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** One labelled value. `verdict` rows (relevance / sentiment / safety) read larger (#338). */
export function Row({
  label,
  size = "default",
  action,
  children,
}: {
  label: string;
  size?: "verdict" | "default";
  action?: ReactNode;
  children: ReactNode;
}) {
  const verdict = size === "verdict";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className={cx("font-medium text-tertiary", verdict ? "text-sm" : "text-xs")}>{label}</span>
        {action ? <span className="ml-auto">{action}</span> : null}
      </div>
      <div className={cx("flex flex-wrap items-center gap-1.5 text-primary", verdict ? "text-md" : "text-sm")}>
        {children}
      </div>
    </div>
  );
}

/** Per-field "Sửa" — opens the override dialog with the field preselected (FR-191, #338). */
export function EditButton({ field, onEdit }: { field: OverrideField; onEdit: (f: OverrideField) => void }) {
  return (
    // #386: 44 px hit area on mobile; negative margin keeps the row height.
    <Button
      color="link-color"
      size="sm"
      className="max-md:-my-3 max-md:min-h-11 max-md:min-w-11"
      aria-label={`Sửa ${FIELD_LABELS[field]}`}
      onClick={() => onEdit(field)}
    >
      Sửa
    </Button>
  );
}

export const Dash = () => <span className="text-quaternary">—</span>;
