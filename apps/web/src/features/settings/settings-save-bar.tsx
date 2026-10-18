"use client";

import { useId } from "react";
import { cx } from "@/utils/cx";
import { Button } from "@/components/base/buttons/button";
import { useRegisterDirty } from "./unsaved-changes";

interface SettingsSaveBarProps {
  /** Registry id of the board (one per form). */
  id: string;
  dirty: boolean;
  onReset: () => void;
  submitLabel: string;
  isLoading?: boolean;
  isDisabled?: boolean;
  /** Bleed into the board's bottom padding; off when content follows the bar (Analysis versions). */
  flushBottom?: boolean;
}

/**
 * Save control for a settings form (#347). Clean: in-place disabled Save + "Chưa có thay đổi". Dirty: sticky strip at
 * the bottom of the board (same language as the Reviews selection bar, #339) with text, "Huỷ thay đổi" and Save — never
 * colour alone (BR-017). Rendered inside the `<form>` so the submit button submits it.
 */
export function SettingsSaveBar({
  id,
  dirty,
  onReset,
  submitLabel,
  isLoading,
  isDisabled,
  flushBottom = true,
}: SettingsSaveBarProps) {
  useRegisterDirty(id, dirty);
  const hintId = useId();
  // One tree for both states so the Save button keeps its identity (and focus) when the form turns dirty.
  return (
    <div
      className={cx(
        dirty
          ? "sticky bottom-0 z-10 -mx-5 flex flex-col gap-3 border-t-2 border-[var(--ink)] bg-[var(--enamel-white)] px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:pb-3"
          : "flex",
        dirty && flushBottom && "-mb-5",
      )}
    >
      {dirty ? (
        <p role="status" className="text-sm font-semibold text-primary">
          Có thay đổi chưa lưu
        </p>
      ) : null}
      <div className={cx("flex gap-3", dirty ? "flex-col gap-2 sm:flex-row sm:gap-3" : "flex-wrap items-center")}>
        {dirty ? (
          <Button color="secondary" className="min-h-11 sm:min-h-0" onClick={onReset} isDisabled={isLoading}>
            Huỷ thay đổi
          </Button>
        ) : null}
        <Button
          type="submit"
          className="min-h-11 sm:min-h-0"
          isDisabled={!dirty || isDisabled}
          isLoading={isLoading}
          aria-describedby={dirty ? undefined : hintId}
        >
          {submitLabel}
        </Button>
        {dirty ? null : (
          <span id={hintId} className="text-sm text-tertiary">
            Chưa có thay đổi
          </span>
        )}
      </div>
    </div>
  );
}
