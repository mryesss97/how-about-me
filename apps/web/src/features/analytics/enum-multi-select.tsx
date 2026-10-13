"use client";

import type { Selection } from "react-aria-components";
import { MultiSelect } from "@/components/base/select/multi-select";
import type { SelectItemType } from "@/components/base/select/select-shared";

interface EnumMultiSelectProps {
  label: string;
  items: SelectItemType[];
  value: readonly string[];
  onChange: (next: string[]) => void;
}

/** Thin controlled wrapper: URL array ↔ React Aria `Selection`. */
export function EnumMultiSelect({ label, items, value, onChange }: EnumMultiSelectProps) {
  const toArray = (keys: Selection) => (keys === "all" ? items.map((i) => String(i.id)) : [...keys].map(String));
  return (
    <MultiSelect
      size="sm"
      label={label}
      placeholder="All"
      items={items}
      selectedKeys={new Set(value)}
      onSelectionChange={(keys) => onChange(toArray(keys))}
      onReset={() => onChange([])}
      onSelectAll={() => onChange(items.map((i) => String(i.id)))}
      className="w-44"
    >
      {(item) => <MultiSelect.Item id={item.id} label={item.label} supportingText={item.supportingText} />}
    </MultiSelect>
  );
}
