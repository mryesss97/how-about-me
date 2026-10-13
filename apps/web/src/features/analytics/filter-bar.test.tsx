import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";
import { FilterBar } from "./filter-bar";

function setup(search = "", props: { showCompare?: boolean } = {}) {
  const onUrlUpdate = vi.fn<(e: UrlUpdateEvent) => void>();
  render(
    <NuqsTestingAdapter searchParams={search} onUrlUpdate={onUrlUpdate}>
      <FilterBar {...props} />
    </NuqsTestingAdapter>,
  );
  const lastQuery = () => onUrlUpdate.mock.calls.at(-1)?.[0].queryString ?? "";
  return { onUrlUpdate, lastQuery };
}

describe("FilterBar (UX §2.1)", () => {
  it("TC-DASH-002: clicking a preset updates the URL", async () => {
    const { lastQuery } = setup();
    await act(async () => fireEvent.click(screen.getByRole("radio", { name: "24h" })));
    await waitFor(() => expect(lastQuery()).toContain("preset=24h"));
  });

  it("TC-DASH-005: applied filters show as chips and removing a chip updates the URL", async () => {
    const { lastQuery } = setup("?sentiment=negative");
    expect(screen.getByText("Sentiment: Negative")).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /remove/i })));
    expect(lastQuery()).not.toContain("sentiment");
  });

  it("BR-016: deselecting the last relevance keeps relevant", async () => {
    const { onUrlUpdate } = setup();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Relevant" })));
    // Default [relevant] is cleared from the URL, i.e. relevance stays relevant.
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].searchParams.get("relevance")).toBeNull();
    expect(screen.getByRole("button", { name: "Relevant" })).toHaveAttribute("aria-pressed", "true");
  });

  it("reset clears every filter", async () => {
    const { lastQuery } = setup("?preset=24h&sentiment=negative&tz=UTC");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Reset" })));
    expect(lastQuery()).toBe("");
  });

  it("hides compare unless showCompare", () => {
    setup();
    expect(screen.queryByText("Compare to previous period")).not.toBeInTheDocument();
  });

  it("shows compare on Overview", () => {
    setup("", { showCompare: true });
    expect(screen.getByText("Compare to previous period")).toBeInTheDocument();
  });
});
