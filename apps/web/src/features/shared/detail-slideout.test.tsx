import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { DetailSlideout } from "./detail-slideout";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams("sentiment=negative"),
}));

/** Stand-in for the Mentions list: a focusable row that opens the slide-out (TC-MEN-020). */
function Harness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <main>
      <article tabIndex={0} data-testid="row" onKeyDown={(e) => e.key === "Enter" && setOpen(true)}>
        row
      </article>
      {open ? (
        <DetailSlideout
          title="Chi tiết bài nhắc"
          regionLabel="Chi tiết"
          fullPageHref={(qs) => `/mentions/1?${qs}`}
          fallbackHref="/mentions"
          onClose={() => {
            onClose();
            setOpen(false);
          }}
        >
          <p>body</p>
        </DetailSlideout>
      ) : null}
    </main>
  );
}

describe("DetailSlideout keyboard (#95, TC-MEN-020, NFR-031)", () => {
  it("Esc closes the slide-out and focus returns to the row that opened it", async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const row = screen.getByTestId("row");
    await act(async () => row.focus());
    await act(async () => {
      fireEvent.keyDown(row, { key: "Enter" });
    });
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    await act(async () => {
      fireEvent.keyDown(document.activeElement ?? dialog, { key: "Escape" });
    });
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(row).toHaveFocus());
  });
});
