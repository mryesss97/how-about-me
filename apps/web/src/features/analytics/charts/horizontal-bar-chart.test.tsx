import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BarRow } from "./chart-data";
import { HorizontalBarChart } from "./horizontal-bar-chart";

const rows: BarRow<"a" | "b" | "other">[] = [
  { key: "a", name: "Alpha", count: 30, share: 0.3 },
  { key: "b", name: "Beta", count: 0, share: 0 },
  { key: "other", name: "Khác", count: 5, share: 0.05 },
];
const getRowHref = (r: BarRow<"a" | "b" | "other">) =>
  r.count > 0 && r.key !== "other" ? `/mentions?x=${r.key}` : null;

describe("HorizontalBarChart (#335, FR-142)", () => {
  it("drillable rows are full-width links naming value + hint; zero and Other rows are plain", () => {
    render(
      <HorizontalBarChart
        rows={rows}
        getFill={() => "red"}
        denominator={100}
        denominatorLabel="lượt nhắc"
        getRowHref={getRowHref}
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/mentions?x=a");
    expect(links[0]).toHaveAccessibleName("Alpha: 30 · 30,0% — Xem bài nhắc");
  });

  it("TC-DASH-016 / NFR-030: every row (incl. zero) prints count · share; FR-140 denominator line", () => {
    render(<HorizontalBarChart rows={rows} getFill={() => "red"} denominator={100} denominatorLabel="lượt nhắc" />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("0 · 0,0%")).toBeInTheDocument();
    expect(screen.getByText("trên 100 lượt nhắc")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("FR-144: per-row denominator is printed on the row instead of the footer", () => {
    render(
      <HorizontalBarChart
        rows={rows}
        getFill={() => "red"}
        denominator={0}
        denominatorLabel="x"
        rowDenominator={() => 60}
        getRowHref={getRowHref}
      />,
    );
    expect(screen.getByRole("link")).toHaveAccessibleName("Alpha: 30 · 30,0% trên 60 — Xem bài nhắc");
    expect(screen.queryByText(/trên 0 x/)).toBeNull();
  });
});
