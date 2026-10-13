import { INTENT_LABELS } from "@how-about-me/taxonomy";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { intentsFixture } from "@/features/shared/overview-fixture.test-utils";
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

  it("FR-142: zero-count intents are not drillable", async () => {
    const data = intentsFixture();
    const zero = data.distribution.find((d) => d.count === 0);
    render(<IntentDistributionChart data={data} getHref={(k) => `/mentions?intent=${k}`} onNavigate={() => {}} />);
    await openTable();
    expect(screen.getAllByRole("link").length).toBe(data.distribution.filter((d) => d.count > 0).length);
    if (zero) expect(screen.queryByRole("link", { name: new RegExp(`^${zero.label}$`, "i") })).toBeNull();
  });
});
