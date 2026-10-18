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
  timezoneChangePatch,
  validateRange,
} from "@/lib/filters";
import { tzLabel } from "@/lib/time/format";

const PINNED_TZ = ["Asia/Ho_Chi_Minh", "UTC"];
const PRESET_LABEL: Record<Preset, string> = {
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

interface TimeControlsProps {
  filters: Filters;
  setFilters: (patch: Partial<Filters>) => void;
}

/** Preset segmented control, custom date range (in selected tz) and timezone picker — UX §2.1, FR-131. */
export function TimeControls({ filters, setFilters }: TimeControlsProps) {
  const [rangeError, setRangeError] = useState<string | null>(null);
  const tzItems = useMemo(() => timezoneItems(), []);
  const pickerValue =
    filters.preset === "custom" && filters.from && filters.to
      ? instantsToCalendarRange(filters.from, filters.to, filters.tz)
      : null;

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
    <div className="flex min-w-0 flex-wrap items-end gap-3">
      <ButtonGroup
        size="sm"
        aria-label="Khoảng thời gian"
        selectedKeys={new Set([filters.preset])}
        disallowEmptySelection
        onSelectionChange={(keys) => {
          const preset = [...keys][0] as Preset | undefined;
          if (!preset || preset === "custom") return;
          setRangeError(null);
          setFilters({ preset, from: null, to: null });
        }}
      >
        {PRESETS.filter((p) => p !== "custom").map((p) => (
          <ButtonGroupItem key={p} id={p}>
            {PRESET_LABEL[p]}
          </ButtonGroupItem>
        ))}
      </ButtonGroup>
      <div className="flex flex-col gap-1">
        <DateRangePicker aria-label="Chọn khoảng ngày" value={pickerValue} onChange={onRangeChange} />
        {rangeError && (
          <p role="alert" className="text-xs text-error-primary">
            {rangeError}
          </p>
        )}
      </div>
      <ComboBox
        size="sm"
        aria-label="Múi giờ"
        placeholder={tzLabel(filters.tz)}
        shortcut={false}
        items={tzItems}
        selectedKey={filters.tz}
        onSelectionChange={(key) => {
          if (!key) return;
          setRangeError(null);
          setFilters(timezoneChangePatch(filters, String(key)));
        }}
        className="w-64"
      >
        {(item) => <SelectItem id={item.id} label={item.label} />}
      </ComboBox>
    </div>
  );
}
