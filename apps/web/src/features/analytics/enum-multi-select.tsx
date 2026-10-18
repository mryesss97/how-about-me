"use client";

import type { Selection } from "react-aria-components";
import { MultiSelect } from "@/components/base/select/multi-select";
import type { SelectItemType } from "@/components/base/select/select-shared";

interface EnumMultiSelectProps {
  label: string;
  items: SelectItemType[];
  value: readonly string[];
  onChange: (next: string[]) => void;
  /** "Bỏ chọn" target; BR-016 relevance resets to [relevant], never empty. */
  onReset?: () => void;
  className?: string;
}

/** Thin controlled wrapper: URL array ↔ React Aria `Selection`. */
export function EnumMultiSelect({ label, items, value, onChange, onReset, className = "w-44" }: EnumMultiSelectProps) {
  const toArray = (keys: Selection) => (keys === "all" ? items.map((i) => String(i.id)) : [...keys].map(String));
  // One value → its label (filter label already sits above); more → "N đã chọn" (#329).
  const formatCount = (count: number) =>
    count === 1 ? (items.find((i) => String(i.id) === value[0])?.label ?? "1 đã chọn") : `${count} đã chọn`;
  return (
    <MultiSelect
      size="sm"
      searchPlaceholder="Tìm…"
      emptyStateTitle="Không có kết quả"
      emptyStateDescription="Thử từ khoá khác."
      resetLabel="Bỏ chọn"
      selectAllLabel="Chọn tất cả"
      selectedCountFormatter={formatCount}
      label={label}
      placeholder="Tất cả"
      items={items}
      selectedKeys={new Set(value)}
      onSelectionChange={(keys) => onChange(toArray(keys))}
      onReset={onReset ?? (() => onChange([]))}
      onSelectAll={() => onChange(items.map((i) => String(i.id)))}
      className={className}
    >
      {(item) => <MultiSelect.Item id={item.id} label={item.label} supportingText={item.supportingText} />}
    </MultiSelect>
  );
}
