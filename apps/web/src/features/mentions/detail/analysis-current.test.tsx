import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnalysisCurrent } from "./analysis-current";
import { detailFixture } from "./fixtures.test-utils";

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
});
