"use client";

import { ChevronDown } from "@untitledui/icons";
import { useState, type ReactNode } from "react";
import { Input } from "@/components/base/input/input";
import { RadioButton, RadioGroup } from "@/components/base/radio-buttons/radio-buttons";
import { cx } from "@/utils/cx";
import { MinutesField } from "./minutes-field";
import {
  DEFAULT_OVERLAP_MINUTES,
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

const OVERLAP_HINT = "Quét lùi thêm để không sót bài đến muộn.";

/** Inter sub-heading section inside the drawer (no boards in drawers, DESIGN.md). */
function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h3 id={id} className="text-sm font-semibold text-primary">
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * Fields of the create/edit drawer in 3 groups — Truy vấn / Lịch quét / Nâng cao (UX §3.5, FR-052, #341).
 * queryValue/queryType are read-only in edit (FR-054, BR-009). "Bật" lives in the drawer footer.
 */
export function QueryFormFields({ mode, values, errors, set, touch }: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(
    values.includeTerms.length > 0 || values.overlapMinutes !== DEFAULT_OVERLAP_MINUTES,
  );
  // Never hide an error inside a collapsed group.
  const advanced = advancedOpen || !!errors.includeTerms || !!errors.overlapMinutes;
  const editing = mode === "edit";
  const field = (f: QueryFormField) => ({ isInvalid: !!errors[f], onBlur: () => touch(f) });
  const topic = values.queryType === "topic_tag";
  return (
    <div className="flex flex-col gap-6">
      <Section id="lq-group-query" title="Truy vấn">
        <RadioGroup
          aria-label="Loại truy vấn"
          value={values.queryType}
          onChange={(v) => set("queryType", v === "topic_tag" ? "topic_tag" : "keyword")}
          isDisabled={editing}
          orientation="horizontal"
          className="flex flex-row flex-wrap gap-4"
        >
          <RadioButton value="keyword" label="Từ khoá" />
          <RadioButton value="topic_tag" label="Chủ đề" />
        </RadioGroup>
        <Input
          label="Giá trị truy vấn"
          value={values.queryValue}
          onChange={(v) => set("queryValue", v)}
          isDisabled={editing}
          autoFocus={!editing}
          icon={topic ? HashPrefix : undefined}
          {...field("queryValue")}
          hint={
            errors.queryValue ??
            (editing ? "Không sửa được. Hãy tạo truy vấn mới." : topic ? "Nhập không có dấu #" : undefined)
          }
        />
        <Input
          label="Tên hiển thị"
          value={values.displayName}
          onChange={(v) => set("displayName", v)}
          autoFocus={editing}
          {...field("displayName")}
          hint={errors.displayName}
        />
        <TermInput
          label="Loại trừ"
          value={values.excludeTerms}
          onChange={(v) => set("excludeTerms", v)}
          {...field("excludeTerms")}
          hint={errors.excludeTerms ?? "Bỏ qua bài có các cụm từ này."}
        />
      </Section>
      <Section id="lq-group-schedule" title="Lịch quét">
        <MinutesField
          label="Chu kỳ quét (phút)"
          presetsLabel="Chu kỳ quét có sẵn"
          presets={INTERVAL_PRESETS}
          value={values.pollIntervalMinutes}
          error={errors.pollIntervalMinutes}
          onChange={(v) => set("pollIntervalMinutes", v)}
          onBlur={() => touch("pollIntervalMinutes")}
        />
        {editing ? null : (
          <Input
            label="Lấy dữ liệu cũ khi tạo (ngày)"
            inputMode="numeric"
            value={values.initialBackfillDays}
            onChange={(v) => set("initialBackfillDays", v)}
            {...field("initialBackfillDays")}
            hint={errors.initialBackfillDays ?? "0–30 ngày. Chỉ áp dụng lần đồng bộ đầu tiên."}
          />
        )}
      </Section>
      <section aria-label="Nâng cao" className="flex flex-col gap-4">
        <h3>
          <button
            type="button"
            aria-expanded={advanced}
            onClick={() => setAdvancedOpen(!advanced)}
            className="flex cursor-pointer items-center gap-1 text-sm font-semibold text-primary"
          >
            Nâng cao
            <ChevronDown aria-hidden className={cx("size-4 transition-transform", advanced && "rotate-180")} />
          </button>
        </h3>
        {advanced ? (
          <>
            <TermInput
              label="Bao gồm"
              value={values.includeTerms}
              onChange={(v) => set("includeTerms", v)}
              {...field("includeTerms")}
              hint={errors.includeTerms}
            />
            <MinutesField
              label="Chồng lấn (phút)"
              presetsLabel="Chồng lấn có sẵn"
              presets={OVERLAP_PRESETS}
              value={values.overlapMinutes}
              error={errors.overlapMinutes}
              hint={OVERLAP_HINT}
              onChange={(v) => set("overlapMinutes", v)}
              onBlur={() => touch("overlapMinutes")}
            />
          </>
        ) : null}
      </section>
    </div>
  );
}

/** Visual `#` prefix for topic tags (BR-004: the schema strips a typed `#` anyway). */
function HashPrefix({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cx("flex items-center justify-center text-md text-tertiary", className)}>
      #
    </span>
  );
}
