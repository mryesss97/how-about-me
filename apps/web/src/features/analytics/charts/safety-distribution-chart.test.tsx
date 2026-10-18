import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { safetyFixture } from "@/features/shared/overview-fixture.test-utils";
import { safetyFill, SafetyDistributionChart } from "./safety-distribution-chart";
import { openTable } from "./table-utils.test-utils";

describe("SafetyDistributionChart", () => {
  it("TC-DASH-014 / FR-137: safe + sensitive + severe = denominator (Total row)", async () => {
    render(<SafetyDistributionChart data={safetyFixture()} />);
    const [header, ...rows] = await openTable();
    expect(header).toEqual(["Mức độ", "Số lượng", "Tỷ lệ"]);
    expect(rows.map((r) => r[0])).toEqual(["An toàn", "Nhạy cảm", "Nghiêm trọng", "Tổng"]);
    const sum = rows.slice(0, 3).reduce((s, r) => s + Number(r[1]), 0);
    expect(rows[3]?.[1]).toBe(String(sum));
    expect(rows[3]?.[1]).toBe("200");
  });

  it("TC-DASH-023 / NFR-030 / #387: each bar row carries icon, label and share; no separate legend", () => {
    render(<SafetyDistributionChart data={safetyFixture()} />);
    const lists = screen.getAllByRole("list");
    expect(lists).toHaveLength(1);
    const items = within(lists[0] as HTMLElement).getAllByRole("listitem");
    const icons = items.map((li) => li.querySelector("svg[data-icon]")?.getAttribute("data-icon"));
    expect(icons).toEqual(["ShieldTick", "AlertTriangle", "AlertOctagon"]);
    expect(items[0]).toHaveTextContent("An toàn");
    expect(items[0]).toHaveTextContent("· 85,0%");
    expect(items[1]).toHaveTextContent("Nhạy cảm");
    expect(items[2]).toHaveTextContent("Nghiêm trọng");
  });

  it("NFR-030: sensitive/severe bars use SVG patterns, safe is solid", () => {
    expect(safetyFill("safe", "p")).not.toMatch(/^url/);
    expect(safetyFill("sensitive", "p")).toBe("url(#p-sensitive)");
    expect(safetyFill("severe", "p")).toBe("url(#p-severe)");
  });

  it("BR-032: denominator 0 → empty state", () => {
    render(<SafetyDistributionChart data={safetyFixture({ denominator: 0, distribution: [] })} />);
    expect(screen.getByText("Chưa có bài nhắc đã phân tích trong khoảng này")).toBeInTheDocument();
  });

  it("error state shows request ID and Retry", async () => {
    const onRetry = vi.fn();
    render(
      <SafetyDistributionChart error={{ code: "INTERNAL", message: "boom", requestId: "req-9" }} onRetry={onRetry} />,
    );
    expect(screen.getByText(/req-9/)).toBeInTheDocument();
    screen.getByRole("button", { name: /thử lại/i }).click();
    expect(onRetry).toHaveBeenCalled();
  });

  it("view-as-table toggle exposes aria-pressed", async () => {
    render(<SafetyDistributionChart data={safetyFixture()} />);
    await openTable();
    expect(screen.getByRole("button", { name: "Bảng" })).toHaveAttribute("aria-pressed", "true");
  });
});
