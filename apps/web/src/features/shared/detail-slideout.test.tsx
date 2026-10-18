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

// #339: nav, J/K, focus on item change; Mentions (no nav) unchanged.
describe("DetailSlideout nav (#339)", () => {
  function NavHarness({ onNext, onPrev, itemKey }: { onNext: () => void; onPrev: () => void; itemKey: string }) {
    return (
      <DetailSlideout
        title="Chi tiết bài viết"
        regionLabel="Chi tiết"
        fullPageHref={() => "/mentions/1"}
        fallbackHref="/reviews"
        onClose={vi.fn()}
        itemKey={itemKey}
        nav={{ label: "2 / 3", onNext, onPrev, prevDisabled: false, nextDisabled: false }}
        footer={<button type="button">Hành động</button>}
      >
        <input aria-label="Ô nhập" />
        <p>body {itemKey}</p>
      </DetailSlideout>
    );
  }

  it("buttons are labelled; J/K call next/prev; ignored in inputs and with modifiers", () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    render(<NavHarness onNext={onNext} onPrev={onPrev} itemKey="a" />);
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mục sau" }));
    fireEvent.click(screen.getByRole("button", { name: "Mục trước" }));
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByText("body a"), { key: "j" });
    fireEvent.keyDown(screen.getByText("body a"), { key: "k" });
    expect(onNext).toHaveBeenCalledTimes(2);
    expect(onPrev).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(screen.getByLabelText("Ô nhập"), { key: "j" });
    fireEvent.keyDown(screen.getByText("body a"), { key: "j", metaKey: true });
    // Outside the dialog (e.g. a portal on top) → ignored.
    fireEvent.keyDown(document.body, { key: "j" });
    expect(onNext).toHaveBeenCalledTimes(2);
    expect(screen.getByText("J/K: chuyển mục · Esc: đóng")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hành động" })).toBeInTheDocument();
  });

  it("focus moves to the heading when the item changes in place", () => {
    const { rerender } = render(<NavHarness onNext={vi.fn()} onPrev={vi.fn()} itemKey="a" />);
    rerender(<NavHarness onNext={vi.fn()} onPrev={vi.fn()} itemKey="b" />);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Chi tiết bài viết" }));
  });

  it("without nav (Mentions): no hint and J does nothing", () => {
    render(
      <DetailSlideout title="T" regionLabel="R" fullPageHref={() => "/m"} fallbackHref="/mentions" onClose={vi.fn()}>
        <p>body</p>
      </DetailSlideout>,
    );
    expect(screen.queryByText(/J\/K/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Mục sau" })).toBeNull();
  });
});
