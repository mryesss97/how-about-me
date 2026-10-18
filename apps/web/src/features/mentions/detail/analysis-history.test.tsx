import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnalysisHistory } from "./analysis-history";
import { analysisErrorLabel } from "@/lib/semantics/analysis-errors";
import { uuid } from "./fixtures.test-utils";

const FULL = "openai|gpt-x|classifier-v2|taxonomy-v1|openai|omni-moderation|safety-policy-v1";

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
            effectiveVersion: FULL,
            createdAt: "2026-10-13T03:00:00.000Z",
            completedAt: null,
            errorCode: "PROVIDER_TIMEOUT",
            estimatedCostUsd: 0.0012,
          },
        ]}
      />,
    );
    expect(screen.getByText("Thủ công")).toBeInTheDocument();
    // #344: model only, full effective version (BR-023) in title.
    expect(screen.getByText("gpt-x")).toHaveAttribute("title", FULL);
    expect(screen.getByText("$0,0012")).toBeInTheDocument();
    // BR-017 / #344: error is Vietnamese text, raw code only in title.
    expect(screen.queryByText("PROVIDER_TIMEOUT")).not.toBeInTheDocument();
    expect(screen.getByTitle("PROVIDER_TIMEOUT")).toHaveTextContent(analysisErrorLabel("PROVIDER_TIMEOUT"));
    // #344: short date "HH:mm dd/MM" in the project tz.
    expect(screen.getByText("03:00 13/10")).toBeInTheDocument();
  });

  it("#344: falls back to the raw version when it has no `|` (legacy data)", () => {
    render(
      <AnalysisHistory
        tz="UTC"
        runs={[
          {
            id: uuid(802),
            status: "completed",
            trigger: "ingest",
            effectiveVersion: "p3/t2/s1",
            createdAt: "2026-10-13T03:00:00.000Z",
            completedAt: "2026-10-13T03:01:00.000Z",
            errorCode: null,
            estimatedCostUsd: null,
          },
        ]}
      />,
    );
    expect(screen.getByText("p3/t2/s1")).toBeInTheDocument();
  });

  it("shows an empty message", () => {
    render(<AnalysisHistory tz="UTC" runs={[]} />);
    expect(screen.getByText("Chưa có lượt phân tích nào.")).toBeInTheDocument();
  });
});
