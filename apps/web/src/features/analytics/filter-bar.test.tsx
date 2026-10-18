import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";
import { FilterBar } from "./filter-bar";
import type * as QueryOptionsModule from "./use-query-options";
import { toQueryFilterOptions } from "./use-query-options";

const mockState = vi.hoisted(() => ({ noQueries: false }));
const Q_KW = "00000000-0000-4000-8000-000000000001";
const Q_TAG = "00000000-0000-4000-8000-000000000002";
const Q_DEL = "00000000-0000-4000-8000-000000000003";
const queries = [
  { id: Q_DEL, displayName: "eventista refund", queryType: "keyword" as const, deletedAt: "2026-10-01T00:00:00.000Z" },
  { id: Q_KW, displayName: "1zone", queryType: "keyword" as const, deletedAt: null },
  { id: Q_TAG, displayName: "1zone", queryType: "topic_tag" as const, deletedAt: null },
];
vi.mock("./use-query-options", async (orig) => {
  const mod: typeof QueryOptionsModule = await orig();
  return { ...mod, useQueryFilterOptions: () => mod.toQueryFilterOptions(mockState.noQueries ? [] : queries) };
});

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
    await act(async () => fireEvent.click(screen.getByRole("radio", { name: "24 giờ" })));
    await waitFor(() => expect(lastQuery()).toContain("preset=24h"));
  });

  it("TC-DASH-005: applied filters show as chips and removing a chip updates the URL", async () => {
    const { lastQuery, onUrlUpdate } = setup("?sentiment=negative");
    expect(screen.getByText("Cảm xúc: Tiêu cực")).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /xoá/i })));
    // Wait for the throttled nuqs flush so the assertion cannot pass vacuously (#237)
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    expect(lastQuery()).not.toContain("sentiment");
  });

  it("BR-016: Mức liên quan is a multi-select; deselecting the last value keeps relevant", async () => {
    const { onUrlUpdate } = setup("?relevance=uncertain");
    expect(screen.getByText("Mức liên quan")).toBeInTheDocument();
    // The trigger shows the single selected value (#329).
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Chưa chắc" })));
    await act(async () => fireEvent.click(await screen.findByRole("option", { name: /Chưa chắc/ })));
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    // Default [relevant] is cleared from the URL, i.e. relevance stays relevant.
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].searchParams.get("relevance")).toBeNull();
  });

  it("BR-016: Bỏ chọn on Mức liên quan resets to relevant, never empty", async () => {
    const { onUrlUpdate } = setup("?relevance=uncertain,irrelevant");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "2 đã chọn" })));
    await act(async () => fireEvent.click(await screen.findByRole("button", { name: "Bỏ chọn" })));
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].searchParams.get("relevance")).toBeNull();
  });

  it("reset clears every filter", async () => {
    const { lastQuery, onUrlUpdate } = setup("?preset=24h&sentiment=negative&tz=UTC");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Đặt lại" })));
    // Wait for the throttled nuqs flush so the assertion cannot pass vacuously (#237)
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    expect(lastQuery()).toBe("");
  });

  it("#332: Truy vấn is hidden when the project has no queries", () => {
    mockState.noQueries = true;
    try {
      setup();
      expect(screen.queryByText("Truy vấn")).not.toBeInTheDocument();
    } finally {
      mockState.noQueries = false;
    }
  });

  it("#332: no Đặt lại with default filters", () => {
    setup();
    expect(screen.queryByRole("button", { name: "Đặt lại" })).not.toBeInTheDocument();
  });

  it("#332: secondary filters count in Bộ lọc khác (n) and as chips", () => {
    setup("?sentiment=negative&topic=ticket");
    expect(screen.getByRole("button", { name: "Bộ lọc khác (2)" })).toBeInTheDocument();
    expect(screen.getByText("Cảm xúc: Tiêu cực")).toBeInTheDocument();
  });

  it("#332: the date range control shows the effective dates for a preset", () => {
    setup();
    expect(screen.getByRole("group", { name: /^Khoảng ngày: \d{2}\/\d{2} – \d{2}\/\d{2}$/ })).toBeInTheDocument();
  });

  it("#240: switching tz on a custom range keeps the calendar dates in the URL", async () => {
    // 1–7 Oct in Asia/Ho_Chi_Minh (GMT+7).
    const { lastQuery, onUrlUpdate } = setup(
      "?preset=custom&from=2026-09-30T17:00:00.000Z&to=2026-10-07T17:00:00.000Z&tz=Asia/Ho_Chi_Minh",
    );
    // Múi giờ lives in "Bộ lọc khác" since #332.
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /^Bộ lọc khác/ })));
    const tz = await screen.findByRole("combobox", { name: /Múi giờ/ });
    await act(async () => {
      tz.focus();
      fireEvent.change(tz, { target: { value: "UTC" } });
    });
    const utc = await screen.findByRole("option", { name: /· UTC$/ });
    await act(async () => fireEvent.click(utc));
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    const params = new URLSearchParams(lastQuery());
    expect(params.get("tz")).toBe("UTC");
    expect(params.get("from")).toBe("2026-10-01T00:00:00.000Z");
    expect(params.get("to")).toBe("2026-10-08T00:00:00.000Z");
  });

  it("#329 / FR-051: Truy vấn lists project queries, active first, deleted marked, tags with #", async () => {
    setup();
    expect(screen.getByText("Truy vấn")).toBeInTheDocument();
    // Truy vấn is the only multi-select in the row showing "Tất cả" (secondary ones sit in "Bộ lọc khác").
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Tất cả" })));
    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["1zone", "#1zone", "eventista refundĐã xoá"]);
  });

  it("#329: a drill-down queryIds chip shows the query name, also for a soft-deleted query", () => {
    setup(`?queryIds=${Q_TAG},${Q_DEL}`);
    expect(screen.getByText("Truy vấn: #1zone")).toBeInTheDocument();
    expect(screen.getByText("Truy vấn: eventista refund")).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(Q_TAG.slice(0, 8)))).not.toBeInTheDocument();
  });

  it("#329: toQueryFilterOptions never doubles # on tags", () => {
    const { names } = toQueryFilterOptions([
      { id: Q_TAG, displayName: "#1zone", queryType: "topic_tag", deletedAt: null },
    ]);
    expect(names[Q_TAG]).toBe("#1zone");
  });

  it("hides compare unless showCompare", () => {
    setup();
    expect(screen.queryByText("So sánh với kỳ trước")).not.toBeInTheDocument();
  });

  it("shows compare on Overview", () => {
    setup("", { showCompare: true });
    expect(screen.getByText("So sánh với kỳ trước")).toBeInTheDocument();
  });
});
