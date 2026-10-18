"use client";

import type { MentionDetail } from "@how-about-me/contracts";
import { Copy01, Link01, LinkExternal01 } from "@untitledui/icons";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { safePermalink } from "../mention-row";
import { useCopy } from "./use-copy";

/** Utility actions in the "Bài gốc" board header — FR-155 (anyone may copy), FR-157 (new tab), #338. */
export function OriginalActions({ mention: m }: { mention: MentionDetail }) {
  const copy = useCopy();
  const link = safePermalink(m.permalink);
  return (
    <div role="group" aria-label="Thao tác bài gốc" className="flex shrink-0 items-center gap-1">
      <ButtonUtility
        color="tertiary"
        size="sm"
        icon={Copy01}
        tooltip="Sao chép ID bài"
        className="max-sm:size-11"
        onClick={() => void copy(m.platformPostId, "ID bài")}
      />
      <ButtonUtility
        color="tertiary"
        size="sm"
        icon={Link01}
        tooltip="Sao chép liên kết"
        className="max-sm:size-11"
        isDisabled={!m.permalink}
        onClick={() => m.permalink && void copy(m.permalink, "liên kết")}
      />
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1 px-2 text-sm font-semibold text-[var(--ink)] underline-offset-2 hover:underline max-sm:min-h-11 max-sm:min-w-11"
        >
          <span className="max-sm:sr-only">Mở trên Threads</span>
          <LinkExternal01 className="size-4" aria-hidden />
        </a>
      ) : null}
    </div>
  );
}
