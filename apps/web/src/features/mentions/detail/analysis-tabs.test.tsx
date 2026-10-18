import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnalysisTabs } from "./analysis-tabs";
import { detailFixture, overrideFixture, uuid } from "./fixtures.test-utils";

describe("AnalysisTabs", () => {
  it("#344: History badge counts runs + overrides", () => {
    const run = {
      id: uuid(901),
      status: "completed" as const,
      trigger: "ingest" as const,
      effectiveVersion: "openai|gpt-x|p|t|s|m|v",
      createdAt: "2026-10-13T03:00:00.000Z",
      completedAt: "2026-10-13T03:01:00.000Z",
      errorCode: null,
      estimatedCostUsd: null,
    };
    const mention = detailFixture({
      runs: [run],
      overrides: [overrideFixture({ id: uuid(902) }), overrideFixture({ id: uuid(903) })],
    });
    render(<AnalysisTabs mention={mention} tz="UTC" />);
    expect(screen.getByRole("tab", { name: /Lịch sử/ })).toHaveTextContent("3");
  });
});
