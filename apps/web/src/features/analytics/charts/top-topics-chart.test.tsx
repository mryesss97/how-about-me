import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { topicsFixture } from "@/features/shared/overview-fixture.test-utils";
import { openTable } from "./table-utils.test-utils";
import { TopTopicsChart } from "./top-topics-chart";

describe("TopTopicsChart", () => {
  it("TC-DASH-015 / FR-138: ≤ 12 topics + Other last, denominator row instead of Total", async () => {
    render(<TopTopicsChart data={topicsFixture()} />);
    const [header, ...rows] = await openTable();
    expect(header).toEqual(["Chủ đề", "Số lượng", "Tỷ lệ"]);
    const labels = rows.slice(0, -1).map((r) => r[0]);
    expect(labels.length).toBeLessThanOrEqual(13);
    expect(labels.at(-1)).toBe("Khác");
    expect(labels).toContain("CSKH");
    expect(rows.at(-1)).toEqual(["Lượt nhắc có chủ đề", "100", "—"]);
    expect(rows.map((r) => r[0])).not.toContain("Tổng");
  });

  it("FR-138: shares summing past 100% show the multi-label note", () => {
    render(<TopTopicsChart data={topicsFixture()} />);
    expect(screen.getByText(/tổng tỷ lệ có thể vượt 100%/)).toBeInTheDocument();
  });

  it("BR-032: denominator 0 → empty state", () => {
    render(<TopTopicsChart data={{ denominator: 0, distribution: [] }} />);
    expect(screen.getByText("Chưa có lượt nhắc đã phân tích trong khoảng này")).toBeInTheDocument();
  });

  it("loading state hides the table toggle", () => {
    render(<TopTopicsChart isLoading />);
    expect(screen.queryByRole("button", { name: "Xem dạng bảng" })).toBeNull();
  });

  it("FR-142: table rows link to their drill-down; aggregated Other is plain text", async () => {
    const getHref = (k: string) => (k === "other" ? null : `/mentions?topic=${k}`);
    render(<TopTopicsChart data={topicsFixture()} getHref={getHref} onNavigate={() => {}} />);
    await openTable();
    expect(screen.getByRole("link", { name: "Vé" })).toHaveAttribute("href", "/mentions?topic=ticket");
    expect(screen.queryByRole("link", { name: "Khác" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Lượt nhắc có chủ đề" })).toBeNull();
  });
});
