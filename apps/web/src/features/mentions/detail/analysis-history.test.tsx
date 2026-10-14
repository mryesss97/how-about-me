import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnalysisHistory } from "./analysis-history";
import { uuid } from "./fixtures.test-utils";

describe("AnalysisHistory (TC-MEN-012)", () => {
  it("shows status, trigger, version, cost and error per run", () => {
    render(
      <AnalysisHistory
        tz="UTC"
        runs={[
          {
            id: uuid(801),
            status: "failed",
            trigger: "manual",
            effectiveVersion: "p3/t2/s1",
            createdAt: "2026-10-13T03:00:00.000Z",
            completedAt: null,
            errorCode: "PROVIDER_TIMEOUT",
            estimatedCostUsd: 0.0012,
          },
        ]}
      />,
    );
    expect(screen.getByText("Thủ công")).toBeInTheDocument();
    expect(screen.getByText("p3/t2/s1")).toBeInTheDocument();
    expect(screen.getByText("$0,0012")).toBeInTheDocument();
    expect(screen.getByText("PROVIDER_TIMEOUT")).toBeInTheDocument();
  });

  it("shows an empty message", () => {
    render(<AnalysisHistory tz="UTC" runs={[]} />);
    expect(screen.getByText("Chưa có lượt phân tích nào.")).toBeInTheDocument();
  });
});
