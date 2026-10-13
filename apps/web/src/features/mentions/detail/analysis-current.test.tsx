import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnalysisCurrent } from "./analysis-current";
import { detailFixture, overrideFixture } from "./fixtures.test-utils";

const TZ = "Asia/Ho_Chi_Minh";

describe("AnalysisCurrent", () => {
  it("expands safety category scores and marks triggered rows with their level (TC-MEN-010)", () => {
    const m = detailFixture({
      analysis: {
        safety: { level: "sensitive" },
        safetyCategoryScores: { harassment: 0.81234, violence: 0.1 },
        safetyTriggered: [{ category: "harassment", score: 0.81234, level: "sensitive" }],
      },
    });
    render(<AnalysisCurrent mention={m} tz={TZ} />);
    expect(screen.queryByRole("table")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show category scores" }));
    const rows = within(screen.getByRole("table", { name: "Safety category scores" })).getAllByRole("row");
    expect(rows[1]).toHaveAttribute("data-triggered", "true");
    expect(rows[1]).toHaveTextContent("Harassment0.812Sensitive");
    expect(rows[2]).not.toHaveAttribute("data-triggered");
  });

  it("lists the 7 version fields and analyzedAt (TC-MEN-011)", () => {
    const m = detailFixture({
      analysis: {
        versions: {
          classifierProvider: "openai",
          classifierModel: "gpt-x",
          promptVersion: "p3",
          taxonomyVersion: "t2",
          safetyProvider: "openai",
          safetyModel: "omni-mod",
          safetyPolicyVersion: "s1",
        },
      },
    });
    render(<AnalysisCurrent mention={m} tz={TZ} />);
    for (const v of ["gpt-x", "p3", "t2", "omni-mod", "s1"]) expect(screen.getByText(v)).toBeInTheDocument();
    expect(screen.getAllByText("openai")).toHaveLength(2);
    expect(screen.getByText("Analyzed at")).toBeInTheDocument();
  });

  // TC-REV-001 / FR-194 / BR-025
  it("overridden field shows the Analyst badge, struck-through AI value and no confidence", () => {
    const m = detailFixture({
      analysis: { sentiment: { label: "neutral", confidence: 0.8 }, overallConfidence: 0.5 },
      overrides: [overrideFixture()],
    });
    const { container } = render(<AnalysisCurrent mention={m} tz={TZ} />);
    expect(screen.getByText("Analyst")).toBeInTheDocument();
    const struck = container.querySelector("s");
    expect(struck).toHaveTextContent("Negative");
    expect(struck).toHaveClass("line-through");
    expect(screen.getByText("AI value: Negative")).toBeInTheDocument();
    expect(screen.getByTestId("analyst-source")).toHaveAttribute("title", expect.stringContaining("Ana Analyst"));
    expect(screen.getByTestId("analyst-source")).toHaveAttribute("title", expect.stringContaining("Sarcasm"));
    // Relevance is still AI and keeps its confidence.
    expect(screen.getAllByText("AI").length).toBeGreaterThan(0);
    expect(screen.getByText("90%")).toBeInTheDocument();
    expect(screen.queryByText("80%")).toBeNull();
    expect(screen.getByText(/are AI values, not analyst overrides/)).toBeInTheDocument();
  });

  it("revoked override is ignored → AI badge only (FR-193)", () => {
    const m = detailFixture({ overrides: [overrideFixture({ revokedAt: "2026-10-13T06:00:00.000Z" })] });
    render(<AnalysisCurrent mention={m} tz={TZ} />);
    expect(screen.queryByText("Analyst")).toBeNull();
    expect(screen.getAllByText("AI").length).toBeGreaterThan(0);
  });

  it("AI value missing at override time shows a dash", () => {
    const m = detailFixture({ overrides: [overrideFixture({ previousValue: null })] });
    render(<AnalysisCurrent mention={m} tz={TZ} />);
    expect(screen.getByText("AI value: —")).toBeInTheDocument();
  });

  it("Revoke only with canOverride; confirm calls onRevoke (FR-193)", () => {
    const m = detailFixture({ overrides: [overrideFixture()] });
    const { unmount } = render(<AnalysisCurrent mention={m} tz={TZ} />);
    expect(screen.queryByRole("button", { name: "Revoke" })).toBeNull();
    unmount();
    const onRevoke = vi.fn();
    render(<AnalysisCurrent mention={m} tz={TZ} canOverride onRevoke={onRevoke} />);
    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    fireEvent.click(screen.getByRole("button", { name: "Revoke override" }));
    expect(onRevoke).toHaveBeenCalledWith(overrideFixture().id);
  });

  it("overridden intents drop the per-chip confidence", () => {
    const m = detailFixture({
      analysis: { intents: [{ label: "complaint", confidence: null }] },
      overrides: [overrideFixture({ field: "intents", previousValue: ["praise"], value: ["complaint"] })],
    });
    render(<AnalysisCurrent mention={m} tz={TZ} />);
    expect(screen.getByText("Complaint")).toBeInTheDocument();
    expect(screen.getByText("AI value: Praise")).toBeInTheDocument();
  });
});
