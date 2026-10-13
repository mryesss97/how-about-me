import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { safetyFixture } from "../overview-fixture.test-utils";
import { safetyFill, SafetyDistributionChart } from "./safety-distribution-chart";
import { openTable } from "./table-utils.test-utils";

describe("SafetyDistributionChart", () => {
  it("TC-DASH-014 / FR-137: safe + sensitive + severe = denominator (Total row)", async () => {
    render(<SafetyDistributionChart data={safetyFixture()} />);
    const [header, ...rows] = await openTable();
    expect(header).toEqual(["Level", "Count", "Share"]);
    expect(rows.map((r) => r[0])).toEqual(["Safe", "Sensitive", "Severe", "Total"]);
    const sum = rows.slice(0, 3).reduce((s, r) => s + Number(r[1]), 0);
    expect(rows[3]?.[1]).toBe(String(sum));
    expect(rows[3]?.[1]).toBe("200");
  });

  it("TC-DASH-023 / NFR-030: legend has label, icon and share text per level", () => {
    const { container } = render(<SafetyDistributionChart data={safetyFixture()} />);
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toEqual(["Safe · 85.0%", "Sensitive · 12.0%", "Severe · 3.0%"]);
    const icons = Array.from(container.querySelectorAll("li svg[data-icon]")).map((s) => s.getAttribute("data-icon"));
    expect(icons).toEqual(["ShieldTick", "AlertTriangle", "AlertOctagon"]);
  });

  it("NFR-030: sensitive/severe bars use SVG patterns, safe is solid", () => {
    expect(safetyFill("safe", "p")).not.toMatch(/^url/);
    expect(safetyFill("sensitive", "p")).toBe("url(#p-sensitive)");
    expect(safetyFill("severe", "p")).toBe("url(#p-severe)");
  });

  it("BR-032: denominator 0 → empty state", () => {
    render(<SafetyDistributionChart data={safetyFixture({ denominator: 0, distribution: [] })} />);
    expect(screen.getByText("No analysed mentions in this range")).toBeInTheDocument();
  });

  it("error state shows request ID and Retry", async () => {
    const onRetry = vi.fn();
    render(
      <SafetyDistributionChart error={{ code: "INTERNAL", message: "boom", requestId: "req-9" }} onRetry={onRetry} />,
    );
    expect(screen.getByText(/req-9/)).toBeInTheDocument();
    screen.getByRole("button", { name: /retry/i }).click();
    expect(onRetry).toHaveBeenCalled();
  });

  it("view-as-table toggle exposes aria-pressed", async () => {
    render(<SafetyDistributionChart data={safetyFixture()} />);
    await openTable();
    expect(screen.getByRole("button", { name: "View as table" })).toHaveAttribute("aria-pressed", "true");
  });
});
