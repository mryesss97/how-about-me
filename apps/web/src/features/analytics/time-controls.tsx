"use client";

import { useMemo, useState } from "react";
import type { DateValue } from "react-aria-components";
import { DateRangePicker } from "@/components/application/date-picker/date-range-picker";
import { ButtonGroup, ButtonGroupItem } from "@/components/base/button-group/button-group";
import { ComboBox } from "@/components/base/select/combobox";
import { SelectItem } from "@/components/base/select/select-item";
import {
  calendarRangeToInstants,
  type Filters,
  instantsToCalendarRange,
  PRESETS,
  type Preset,
  rangeLabel,
  resolveRange,
  timezoneChangePatch,
  validateRange,
} from "@/lib/filters";
import { tzLabel } from "@/lib/time/format";
import { cx } from "@/utils/cx";

const PINNED_TZ = ["Asia/Ho_Chi_Minh", "UTC"];
export const PRESET_LABEL: Record<Preset, string> = {
  "1h": "1 giờ",
  "24h": "24 giờ",
  "7d": "7 ngày",
  "30d": "30 ngày",
  custom: "Chọn ngày",
};

function timezoneItems() {
  const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  return [...PINNED_TZ, ...all.filter((tz) => !PINNED_TZ.includes(tz))].map((tz) => ({ id: tz, label: tzLabel(tz) }));
}

export interface FilterControlProps {
  filters: Filters;
  setFilters: (patch: Partial<Filters>) => void;
}

/** Preset segmented control — UX §2.1, FR-131. */
export function TimePresets({ filters, setFilters }: FilterControlProps) {
  return (
    <ButtonGroup
      size="sm"
      aria-label="Khoảng thời gian"
      selectedKeys={new Set([filters.preset])}
      disallowEmptySelection
      onSelectionChange={(keys) => {
        const preset = [...keys][0] as Preset | undefined;
        if (!preset || preset === "custom") return;
        setFilters({ preset, from: null, to: null });
      }}
    >
      {PRESETS.filter((p) => p !== "custom").map((p) => (
        <ButtonGroupItem key={p} id={p}>
          {PRESET_LABEL[p]}
        </ButtonGroupItem>
      ))}
    </ButtonGroup>
  );
}

/**
 * Date range picker that always shows the effective dates (#332): relative presets show their resolved range,
 * picking days switches to `custom`. Dates are read in the selected tz, never the browser tz.
 */
export function DateRangeControl({ filters, setFilters }: FilterControlProps) {
  const [rangeError, setRangeError] = useState<string | null>(null);
  const range = resolveRange(filters);
  const pickerValue = instantsToCalendarRange(new Date(range.from), new Date(range.to), filters.tz);

  const onRangeChange = (v: { start: DateValue; end: DateValue } | null) => {
    if (!v) return;
    const { from, to } = calendarRangeToInstants(
      v.start.toString().slice(0, 10),
      v.end.toString().slice(0, 10),
      filters.tz,
    );
    const error = validateRange(from, to);
    setRangeError(error);
    // TC-DASH-003: invalid ranges never reach the URL.
    if (!error) setFilters({ preset: "custom", from, to });
  };

  return (
    <div className="flex flex-col gap-1">
      <DateRangePicker
        aria-label={`Khoảng ngày: ${rangeLabel(filters)}`}
        value={pickerValue}
        onChange={onRangeChange}
      />
      {rangeError && (
        <p role="alert" className="text-xs text-error-primary">
          {rangeError}
        </p>
      )}
    </div>
  );
}

/** Timezone picker; #240 keeps calendar dates of a custom range when tz changes. */
export function TimezoneSelect({ filters, setFilters, className }: FilterControlProps & { className?: string }) {
  const tzItems = useMemo(() => timezoneItems(), []);
  return (
    <ComboBox
      size="sm"
      label="Múi giờ"
      placeholder={tzLabel(filters.tz)}
      shortcut={false}
      items={tzItems}
      selectedKey={filters.tz}
      onSelectionChange={(key) => {
        if (!key) return;
        setFilters(timezoneChangePatch(filters, String(key)));
      }}
      className={cx("w-full", className)}
    >
      {(item) => <SelectItem id={item.id} label={item.label} />}
    </ComboBox>
  );
}
