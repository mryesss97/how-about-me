import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { topicsFixture } from "../overview-fixture.test-utils";
import { openTable } from "./table-utils.test-utils";
import { TopTopicsChart } from "./top-topics-chart";

describe("TopTopicsChart", () => {
  it("TC-DASH-015 / FR-138: ≤ 12 topics + Other last, denominator row instead of Total", async () => {
    render(<TopTopicsChart data={topicsFixture()} />);
    const [header, ...rows] = await openTable();
    expect(header).toEqual(["Topic", "Count", "Share"]);
    const labels = rows.slice(0, -1).map((r) => r[0]);
    expect(labels.length).toBeLessThanOrEqual(13);
    expect(labels.at(-1)).toBe("Other");
    expect(labels).toContain("Customer service");
    expect(rows.at(-1)).toEqual(["Mentions with a topic", "100", "—"]);
    expect(rows.map((r) => r[0])).not.toContain("Total");
  });

  it("FR-138: shares summing past 100% show the multi-label note", () => {
    render(<TopTopicsChart data={topicsFixture()} />);
    expect(screen.getByText(/shares can add up to more than 100%/)).toBeInTheDocument();
  });

  it("BR-032: denominator 0 → empty state", () => {
    render(<TopTopicsChart data={{ denominator: 0, distribution: [] }} />);
    expect(screen.getByText("No analysed mentions in this range")).toBeInTheDocument();
  });

  it("loading state hides the table toggle", () => {
    render(<TopTopicsChart isLoading />);
    expect(screen.queryByRole("button", { name: "View as table" })).toBeNull();
  });
});
