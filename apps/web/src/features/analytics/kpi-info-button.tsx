"use client";

import { InfoCircle } from "@untitledui/icons";
import {
  Button as AriaButton,
  Dialog as AriaDialog,
  DialogTrigger as AriaDialogTrigger,
  Popover as AriaPopover,
} from "react-aria-components";

/**
 * #386 / FR-140: the KPI ⓘ opens on press (touch, click, Enter) — a hover-only tooltip never opens on a phone.
 * 44×44 hit area via negative margin so the label row keeps its layout; sits above the card's stretched link.
 */
export function KpiInfoButton({
  label,
  definition,
  denominator,
}: {
  label: string;
  definition: string;
  denominator: string;
}) {
  return (
    <AriaDialogTrigger>
      <AriaButton
        aria-label={`Giải thích ${label}`}
        className="relative z-10 -m-3.5 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center text-quaternary outline-focus-ring focus-visible:outline-2"
      >
        <InfoCircle aria-hidden="true" className="size-4" />
      </AriaButton>
      <AriaPopover placement="bottom start" offset={4} className="max-w-[280px]">
        <AriaDialog
          aria-label={label}
          className="flex flex-col items-start gap-1 rounded-lg bg-primary-solid px-3 py-3 shadow-lg outline-hidden"
        >
          <p className="text-xs font-semibold text-white">{definition}</p>
          <p className="text-xs font-medium text-tooltip-supporting-text">{`Mẫu số: ${denominator}`}</p>
        </AriaDialog>
      </AriaPopover>
    </AriaDialogTrigger>
  );
}
