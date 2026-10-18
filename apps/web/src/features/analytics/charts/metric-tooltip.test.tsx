import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DRILL_HINT, MetricTooltip } from "./metric-tooltip";

describe("MetricTooltip (#335)", () => {
  const props = { title: "T", lines: [{ name: "A", count: 1, share: 0.5 }], denominator: 2 };

  it("FR-142: drillable shows the click hint", () => {
    render(<MetricTooltip {...props} drillable />);
    expect(screen.getByText(DRILL_HINT)).toHaveTextContent("Bấm để xem bài nhắc");
  });

  it("not drillable (e.g. zero count) → no hint", () => {
    render(<MetricTooltip {...props} />);
    expect(screen.queryByText(DRILL_HINT)).toBeNull();
  });
});
