"use client";

import type { Override } from "@how-about-me/contracts";
import { useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { ValueSourceBadge } from "@/features/shared/semantic-badge";
import { SettingsDialog } from "@/features/shared/settings-dialog";
import { formatValue, overrideTooltip } from "./overrides";

type Props = {
  /** Active override on this field, if any (BR-025). */
  override: Override | undefined;
  /** Whether the field currently shows a value — the AI badge is only drawn next to a value. */
  hasValue: boolean;
  tz: string;
  canRevoke: boolean;
  onRevoke?: (overrideId: string) => void;
  isRevoking: boolean;
};

/**
 * Source of a displayed value — FR-194, UX §2.2/§3.4. Overridden: "Analyst" badge (tooltip with who/when/why),
 * then the AI value at override time struck through, with screen-reader text so the strike is not the only cue.
 */
export function ValueSource({ override: o, hasValue, tz, canRevoke, onRevoke, isRevoking }: Props) {
  const [confirm, setConfirm] = useState(false);
  if (!o) return hasValue ? <ValueSourceBadge source="ai" /> : null;
  const ai = formatValue(o.previousValue, o.field);
  return (
    <>
      <span title={overrideTooltip(o, tz)} data-testid="analyst-source">
        <ValueSourceBadge source="analyst" />
        <span className="sr-only">{overrideTooltip(o, tz)}</span>
      </span>
      <span className="text-xs text-tertiary" title="Giá trị AI lúc ghi đè">
        <span aria-hidden>AI: </span>
        <s aria-hidden className="line-through">
          {ai}
        </s>
        <span className="sr-only">{`Giá trị AI: ${ai}`}</span>
      </span>
      {canRevoke && onRevoke ? (
        <>
          <Button color="link-color" size="sm" isDisabled={isRevoking} onClick={() => setConfirm(true)}>
            Thu hồi
          </Button>
          <SettingsDialog isOpen={confirm} onClose={() => setConfirm(false)} title="Thu hồi ghi đè này?">
            <p className="text-sm text-tertiary">Giá trị AI được áp dụng lại. Ghi đè vẫn nằm trong Lịch sử.</p>
            <div className="flex justify-end gap-2">
              <Button size="sm" color="secondary" onClick={() => setConfirm(false)}>
                Huỷ
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setConfirm(false);
                  onRevoke(o.id);
                }}
              >
                Thu hồi ghi đè
              </Button>
            </div>
          </SettingsDialog>
        </>
      ) : null}
    </>
  );
}
