"use client";

import { Expand06 } from "@untitledui/icons";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { SlideoutMenu } from "@/components/application/slideout-menus/slideout-menu";
import { MentionDetail } from "./mention-detail";

/**
 * Slide-out opened from the Mentions list via the intercepting route `@detail/(.)[id]` (UX §3.4, TC-MEN-009).
 * Esc / close → back to the list with its filters; React Aria returns focus to the row that opened it.
 */
export function MentionDetailSlideout({ mentionId }: { mentionId: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const [open, setOpen] = useState(true);
  const qs = search?.toString() ?? "";

  const close = useCallback(() => {
    setOpen(false);
    // Opened from the list → history has the list entry. Deep links render the full page, not this slide-out.
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push(`/mentions${qs ? `?${qs}` : ""}`);
  }, [router, qs]);

  return (
    <SlideoutMenu
      isOpen={open}
      onOpenChange={(o) => !o && close()}
      isDismissable
      // SlideoutMenu puts `className` on both the overlay and the panel, so widen the panel via the
      // overlay's child selector; a plain max-w here would shrink the full-screen overlay too.
      className="z-50 md:*:max-w-3xl"
      dialogClassName="gap-4"
    >
      <SlideoutMenu.Header onClose={close}>
        <div className="flex items-center gap-3 pr-8">
          <h2 className="text-lg font-semibold text-primary">Mention detail</h2>
          {/* Plain <a> on purpose: a full navigation escapes the intercepting route and renders the page. */}
          <a
            href={`/mentions/${mentionId}${qs ? `?${qs}` : ""}`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand-secondary hover:underline"
          >
            <Expand06 className="size-4" aria-hidden />
            Open full page
          </a>
        </div>
      </SlideoutMenu.Header>
      <SlideoutMenu.Content role="region" aria-label="Mention detail" className="pb-6">
        <MentionDetail mentionId={mentionId} variant="slideout" />
      </SlideoutMenu.Content>
    </SlideoutMenu>
  );
}
