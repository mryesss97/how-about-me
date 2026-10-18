import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { timeseriesFixture } from "@/features/shared/overview-fixture.test-utils";
import { MentionsOverTimeChart } from "./mentions-over-time-chart";
import { openTable } from "./table-utils.test-utils";

describe("MentionsOverTimeChart", () => {
  it("TC-DASH-012 / FR-135: zero-filled buckets all appear and sum to the total", async () => {
    render(<MentionsOverTimeChart data={timeseriesFixture()} />);
    const [header, ...rows] = await openTable();
    expect(header).toEqual(["Thời gian", "Lượt nhắc"]);
    expect(rows).toHaveLength(7);
    expect(rows[0]?.[0]).toBe("06/10");
    expect(rows.reduce((s, r) => s + Number(r[1]), 0)).toBe(20);
  });

  it("TC-DASH-017 / FR-141: compare adds a Previous column; absent otherwise", async () => {
    render(<MentionsOverTimeChart data={timeseriesFixture(true)} />);
    const [header, ...rows] = await openTable();
    expect(header).toEqual(["Thời gian", "Lượt nhắc", "Kỳ trước"]);
    expect(rows[6]?.[2]).toBe("6");
  });

  it("BR-032: all-zero range shows empty state", () => {
    const data = timeseriesFixture();
    render(<MentionsOverTimeChart data={{ ...data, data: data.data.map((d) => ({ ...d, mentions: 0 })) }} />);
    expect(screen.getByText("Không có lượt nhắc trong khoảng này")).toBeInTheDocument();
  });

  it("TC-DASH-017: zero mentions now but a previous period still renders the chart, not the empty state", () => {
    const data = timeseriesFixture(true);
    render(<MentionsOverTimeChart data={{ ...data, data: data.data.map((d) => ({ ...d, mentions: 0 })) }} />);
    expect(screen.queryByText("Không có lượt nhắc trong khoảng này")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bảng" })).toBeInTheDocument();
  });
});
