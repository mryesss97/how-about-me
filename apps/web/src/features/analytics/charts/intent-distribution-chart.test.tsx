import { INTENT_LABELS } from "@how-about-me/taxonomy";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { intentsFixture } from "../overview-fixture.test-utils";
import { IntentDistributionChart } from "./intent-distribution-chart";
import { openTable } from "./table-utils.test-utils";

describe("IntentDistributionChart", () => {
  it("TC-DASH-016 / FR-139: every intent label appears, including zero counts", async () => {
    render(<IntentDistributionChart data={intentsFixture()} />);
    const [header, ...rows] = await openTable();
    expect(header).toEqual(["Intent", "Count", "Share"]);
    expect(rows).toHaveLength(INTENT_LABELS.length + 1);
    expect(rows.find((r) => r[0] === "Boycott")).toEqual(["Boycott", "0", "0.0%"]);
    expect(rows.at(-1)).toEqual(["Mentions with an intent", "50", "—"]);
  });

  it("TC-DASH-016: shares may exceed 100% → note shown", () => {
    render(<IntentDistributionChart data={intentsFixture()} />);
    expect(screen.getByText(/shares can add up to more than 100%/)).toBeInTheDocument();
  });

  it("error state shows request ID", () => {
    render(
      <IntentDistributionChart error={{ code: "INTERNAL", message: "x", requestId: "req-1" }} onRetry={() => {}} />,
    );
    expect(screen.getByText(/req-1/)).toBeInTheDocument();
  });
});
