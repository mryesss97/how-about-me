import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { sentimentFixture } from "../overview-fixture.test-utils";
import { SentimentDistributionChart } from "./sentiment-distribution-chart";
import { openTable } from "./table-utils.test-utils";

describe("SentimentDistributionChart", () => {
  it("TC-DASH-013 / FR-136: positive + neutral + negative = denominator", async () => {
    render(<SentimentDistributionChart data={sentimentFixture()} />);
    const [header, ...rows] = await openTable();
    expect(header).toEqual(["Sentiment", "Count", "Share"]);
    expect(rows.map((r) => r[0])).toEqual(["Positive", "Neutral", "Negative", "Total"]);
    const sum = rows.slice(0, 3).reduce((s, r) => s + Number(r[1]), 0);
    expect(rows[3]?.[1]).toBe(String(sum));
    expect(rows[3]?.[1]).toBe("100");
    expect(rows[0]?.[2]).toBe("30.0%");
  });

  it("NFR-030: legend lists every label with its share as text, in sentiment order", () => {
    render(<SentimentDistributionChart data={sentimentFixture()} />);
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toEqual(["Positive · 30.0%", "Neutral · 50.0%", "Negative · 20.0%"]);
  });

  it("BR-032: denominator 0 → empty state, no division by zero", () => {
    render(
      <SentimentDistributionChart
        data={sentimentFixture({
          denominator: 0,
          distribution: [{ label: "positive", count: 0, share: null }],
        })}
      />,
    );
    expect(screen.getByText("No analysed mentions in this range")).toBeInTheDocument();
  });
});
