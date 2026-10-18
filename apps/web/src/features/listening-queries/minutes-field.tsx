"use client";

import { useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";

type Props = {
  /** Input label, e.g. "Chu kỳ quét (phút)". */
  label: string;
  presetsLabel: string;
  presets: readonly { minutes: number; label: string }[];
  value: string;
  error?: string;
  hint?: string;
  onChange: (minutes: string) => void;
  onBlur: () => void;
};

/**
 * Minute presets plus a "Khác…" free input (#341). The input shows when picked, when the value is not a preset,
 * or when there is an error, so a hidden field never blocks submit silently. Selection is conveyed by
 * `aria-pressed` + label, not colour alone (BR-017).
 */
export function MinutesField({ label, presetsLabel, presets, value, error, hint, onChange, onBlur }: Props) {
  const isPreset = presets.some((p) => String(p.minutes) === value);
  const [custom, setCustom] = useState(!isPreset);
  const showInput = custom || !isPreset || !!error;
  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label={presetsLabel} className="flex flex-wrap gap-2">
        {presets.map((p) => {
          const on = !showInput && value === String(p.minutes);
          return (
            <Button
              key={p.minutes}
              type="button"
              size="sm"
              color={on ? "primary" : "secondary"}
              aria-pressed={on}
              onClick={() => {
                setCustom(false);
                onChange(String(p.minutes));
              }}
            >
              {p.label}
            </Button>
          );
        })}
        <Button
          type="button"
          size="sm"
          color={showInput ? "primary" : "secondary"}
          aria-pressed={showInput}
          onClick={() => setCustom(true)}
        >
          Khác…
        </Button>
      </div>
      {showInput ? (
        <Input
          label={label}
          inputMode="numeric"
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          isInvalid={!!error}
          hint={error ?? hint}
        />
      ) : hint ? (
        <p className="text-sm text-tertiary">{hint}</p>
      ) : null}
    </div>
  );
}
