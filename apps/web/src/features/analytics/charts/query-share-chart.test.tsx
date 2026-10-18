import type { QueryShareResponse } from "@how-about-me/contracts";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OVERLAP_NOTE, QueryShareChart } from "./query-share-chart";
import { openTable } from "./table-utils.test-utils";

const Q1 = "00000000-0000-4000-8000-000000000001";
const Q2 = "00000000-0000-4000-8000-000000000002";
const Q3 = "00000000-0000-4000-8000-000000000003";

const fixture = (): QueryShareResponse => ({
  denominator: 10,
  distribution: [
    { queryId: Q2, displayName: "beta", count: 8, share: 0.8 },
    { queryId: Q1, displayName: "alpha", count: 5, share: 0.5 },
    { queryId: Q3, displayName: "gamma", count: 0, share: 0 },
  ],
  note: "overlapping",
});

describe("QueryShareChart (T-150)", () => {
  it("A2 / FR-145: keeps API order, ends with the distinct-mentions row, no summed Total", async () => {
    render(<QueryShareChart data={fixture()} />);
    const [header, ...rows] = await openTable();
    expect(header).toEqual(["Truy vấn", "Số lượng", "Tỷ lệ"]);
    expect(rows.map((r) => r[0])).toEqual(["beta", "alpha", "gamma", "Bài nhắc (không trùng)"]);
    expect(rows.at(-1)).toEqual(["Bài nhắc (không trùng)", "10", "—"]);
    expect(rows.map((r) => r[0])).not.toContain("Tổng");
  });

  it("FR-147: the overlap note is always shown when there is data", () => {
    render(<QueryShareChart data={fixture()} />);
    expect(screen.getByText(OVERLAP_NOTE)).toBeInTheDocument();
  });

  it("#329: tags render with # via queryNames; overlap note is Vietnamese", async () => {
    render(<QueryShareChart data={fixture()} queryNames={{ [Q2]: "#beta" }} />);
    expect(OVERLAP_NOTE).toMatch(/^Một bài nhắc/);
    const [, ...rows] = await openTable();
    expect(rows.map((r) => r[0])).toEqual(["#beta", "alpha", "gamma", "Bài nhắc (không trùng)"]);
  });

  it("BR-032: denominator 0 → empty state", () => {
    render(<QueryShareChart data={{ denominator: 0, distribution: [], note: "overlapping" }} />);
    expect(screen.getByText("Không có bài nhắc trong khoảng này")).toBeInTheDocument();
  });

  it("loading state hides the table toggle", () => {
    render(<QueryShareChart isLoading />);
    expect(screen.queryByRole("button", { name: "Bảng" })).toBeNull();
  });

  it("error state shows request ID and Retry", () => {
    const onRetry = vi.fn();
    render(<QueryShareChart error={{ code: "INTERNAL", message: "boom", requestId: "req-9" }} onRetry={onRetry} />);
    expect(screen.getByText(/req-9/)).toBeInTheDocument();
    screen.getByRole("button", { name: /thử lại/i }).click();
    expect(onRetry).toHaveBeenCalled();
  });

  it("FR-142: rows link to queryIds drill-down; count 0 is plain text", async () => {
    const getHref = (id: string) => `/mentions?queryIds=${id}`;
    render(<QueryShareChart data={fixture()} getHref={getHref} onNavigate={() => {}} />);
    await openTable();
    expect(screen.getByRole("link", { name: "beta" })).toHaveAttribute("href", `/mentions?queryIds=${Q2}`);
    expect(screen.queryByRole("link", { name: "gamma" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Bài nhắc (không trùng)" })).toBeNull();
  });
});
