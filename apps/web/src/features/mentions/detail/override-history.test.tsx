import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { overrideFixture, uuid } from "./fixtures.test-utils";
import { OverrideHistory } from "./override-history";

// FR-193: revoked overrides stay visible in history with who/when.
describe("OverrideHistory", () => {
  it("lists active and revoked overrides", () => {
    const revoked = overrideFixture({
      id: uuid(2),
      revokedAt: "2026-10-13T06:00:00.000Z",
      revokedBy: { id: uuid(3), displayName: "Adam Admin" },
    });
    render(<OverrideHistory overrides={[overrideFixture(), revoked]} tz="UTC" />);
    const rows = within(screen.getByRole("table", { name: "Analyst overrides" })).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Negative → Neutral");
    expect(rows[1]).toHaveTextContent("Active");
    expect(rows[2]).toHaveTextContent("Adam Admin");
  });
  it("renders nothing without overrides", () => {
    const { container } = render(<OverrideHistory overrides={[]} tz="UTC" />);
    expect(container).toBeEmptyDOMElement();
  });
});
