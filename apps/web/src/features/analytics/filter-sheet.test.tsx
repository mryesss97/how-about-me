import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";
import { FilterBar } from "./filter-bar";

vi.mock("./use-query-options", () => ({ useQueryFilterOptions: () => ({ items: [], names: {} }) }));

function setup(search = "") {
  const onUrlUpdate = vi.fn<(e: UrlUpdateEvent) => void>();
  render(
    <NuqsTestingAdapter searchParams={search} onUrlUpdate={onUrlUpdate}>
      <FilterBar />
    </NuqsTestingAdapter>,
  );
  return { onUrlUpdate };
}

// #332: below lg, a summary strip + bottom sheet replace the filter panel (UX §4).
describe("FilterSheet", () => {
  it("strip shows preset, dates and the active filter count", () => {
    setup("?sentiment=negative&topic=ticket");
    expect(screen.getByText(/^7 ngày · \d{2}\/\d{2} – \d{2}\/\d{2} · 2 bộ lọc$/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bộ lọc, 2 đang áp dụng" })).toBeInTheDocument();
  });

  it("Xong closes the sheet", async () => {
    setup();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /^Bộ lọc, / })));
    const dialog = await screen.findByRole("dialog");
    await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: "Xong" })));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("plaque opens the sheet; Escape closes it and focus returns to the plaque", async () => {
    setup();
    const plaque = screen.getByRole("button", { name: /^Bộ lọc, / });
    await act(async () => {
      plaque.focus();
      fireEvent.click(plaque);
    });
    const dialog = await screen.findByRole("dialog");
    await act(async () => fireEvent.keyDown(document.activeElement ?? dialog, { key: "Escape" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(plaque).toHaveFocus());
  });

  it("changing a filter in the sheet updates the URL (live)", async () => {
    const { onUrlUpdate } = setup();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /^Bộ lọc, / })));
    const dialog = await screen.findByRole("dialog");
    await act(async () => fireEvent.click(within(dialog).getByRole("radio", { name: "24 giờ" })));
    await waitFor(() => expect(onUrlUpdate.mock.calls.at(-1)?.[0].queryString).toContain("preset=24h"));
  });
});
