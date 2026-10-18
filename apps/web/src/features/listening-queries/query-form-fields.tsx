"use client";

import { ChevronDown } from "@untitledui/icons";
import { useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { RadioButton, RadioGroup } from "@/components/base/radio-buttons/radio-buttons";
import { Toggle } from "@/components/base/toggle/toggle";
import { cx } from "@/utils/cx";
import {
  INTERVAL_PRESETS,
  OVERLAP_PRESETS,
  type QueryFormErrors,
  type QueryFormField,
  type QueryFormMode,
  type QueryFormValues,
} from "./query-form";
import { TermInput } from "./term-input";

type Props = {
  mode: QueryFormMode;
  values: QueryFormValues;
  errors: QueryFormErrors;
  set: <K extends QueryFormField>(field: K, value: QueryFormValues[K]) => void;
  touch: (field: QueryFormField) => void;
};

function Presets({
  label,
  presets,
  value,
  onPick,
}: {
  label: string;
  presets: readonly { seconds: number; label: string }[];
  value: string;
  onPick: (seconds: number) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {presets.map((p) => (
        <Button
          key={p.seconds}
          type="button"
          size="sm"
          color={value === String(p.seconds) ? "primary" : "secondary"}
          aria-pressed={value === String(p.seconds)}
          onClick={() => onPick(p.seconds)}
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
}

/** Fields of the create/edit drawer (UX §3.5, FR-052). queryValue/queryType are read-only in edit (FR-054, BR-009). */
export function QueryFormFields({ mode, values, errors, set, touch }: Props) {
  const [advanced, setAdvanced] = useState(values.includeTerms.length > 0);
  const editing = mode === "edit";
  const field = (f: QueryFormField) => ({ isInvalid: !!errors[f], onBlur: () => touch(f) });
  return (
    <div className="flex flex-col gap-5">
      <Input
        label="Tên hiển thị"
        value={values.displayName}
        onChange={(v) => set("displayName", v)}
        {...field("displayName")}
        hint={errors.displayName}
        autoFocus
      />
      <Input
        label="Giá trị truy vấn"
        value={values.queryValue}
        onChange={(v) => set("queryValue", v)}
        isDisabled={editing}
        {...field("queryValue")}
        hint={errors.queryValue ?? (editing ? "Không sửa được. Hãy tạo truy vấn mới." : "Nhập không có dấu #")}
      />
      <RadioGroup
        aria-label="Loại truy vấn"
        value={values.queryType}
        onChange={(v) => set("queryType", v === "topic_tag" ? "topic_tag" : "keyword")}
        isDisabled={editing}
        className="gap-2"
      >
        <p className="text-sm font-medium text-secondary">Loại</p>
        <RadioButton value="keyword" label="Từ khoá" />
        <RadioButton value="topic_tag" label="Chủ đề" />
      </RadioGroup>
      <TermInput
        label="Loại trừ"
        value={values.excludeTerms}
        onChange={(v) => set("excludeTerms", v)}
        {...field("excludeTerms")}
        hint={errors.excludeTerms}
      />
      <div className="flex flex-col gap-3">
        <button
          type="button"
          aria-expanded={advanced}
          onClick={() => setAdvanced((a) => !a)}
          className="flex cursor-pointer items-center gap-1 self-start text-sm font-semibold text-brand-secondary"
        >
          Nâng cao
          <ChevronDown aria-hidden className={cx("size-4 transition-transform", advanced && "rotate-180")} />
        </button>
        {advanced ? (
          <TermInput
            label="Bao gồm"
            value={values.includeTerms}
            onChange={(v) => set("includeTerms", v)}
            {...field("includeTerms")}
            hint={errors.includeTerms}
          />
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <Input
          label="Chu kỳ quét (giây)"
          inputMode="numeric"
          value={values.pollIntervalSeconds}
          onChange={(v) => set("pollIntervalSeconds", v)}
          {...field("pollIntervalSeconds")}
          hint={errors.pollIntervalSeconds}
        />
        <Presets
          label="Chu kỳ quét có sẵn"
          presets={INTERVAL_PRESETS}
          value={values.pollIntervalSeconds}
          onPick={(s) => set("pollIntervalSeconds", String(s))}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Input
          label="Chồng lấn (giây)"
          inputMode="numeric"
          value={values.overlapSeconds}
          onChange={(v) => set("overlapSeconds", v)}
          {...field("overlapSeconds")}
          hint={errors.overlapSeconds}
        />
        <Presets
          label="Chồng lấn có sẵn"
          presets={OVERLAP_PRESETS}
          value={values.overlapSeconds}
          onPick={(s) => set("overlapSeconds", String(s))}
        />
      </div>
      <Input
        label="Lấy dữ liệu cũ (ngày)"
        inputMode="numeric"
        value={values.initialBackfillDays}
        onChange={(v) => set("initialBackfillDays", v)}
        {...field("initialBackfillDays")}
        hint={errors.initialBackfillDays ?? "0–30 ngày. Chỉ áp dụng lần đồng bộ đầu tiên."}
      />
      <Toggle size="sm" label="Bật" isSelected={values.enabled} onChange={(v) => set("enabled", v)} />
    </div>
  );
}
