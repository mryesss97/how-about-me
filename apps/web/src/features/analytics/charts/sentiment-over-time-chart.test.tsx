import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { sentimentFixture } from "@/features/shared/overview-fixture.test-utils";
import { SentimentOverTimeChart } from "./sentiment-over-time-chart";
import { openTable } from "./table-utils.test-utils";

describe("SentimentOverTimeChart", () => {
  it("FR-136: table has per-bucket Total, labelled in the filter tz", async () => {
    render(<SentimentOverTimeChart data={sentimentFixture()} timezone="Asia/Ho_Chi_Minh" />);
    const [header, ...rows] = await openTable();
    expect(header).toEqual(["Thời gian", "Tích cực", "Trung tính", "Tiêu cực", "Tổng"]);
    expect(rows).toEqual([
      ["06/10", "10", "20", "5", "35"],
      ["07/10", "20", "30", "15", "65"],
    ]);
  });
});

describe("SentimentOverTimeChart drill-down (#335, FR-142)", () => {
  const getSegmentHref = (i: number, k: string | null) => `/mentions?b=${i}${k ? `&sentiment=${k}` : ""}`;

  it("time cell → bucket, sentiment cells → bucket + sentiment, Total is text", async () => {
    render(
      <SentimentOverTimeChart
        data={sentimentFixture()}
        timezone="Asia/Ho_Chi_Minh"
        getSegmentHref={getSegmentHref}
        onNavigate={() => {}}
      />,
    );
    await openTable();
    expect(screen.getByRole("link", { name: "06/10" })).toHaveAttribute("href", "/mentions?b=0");
    expect(screen.getByRole("link", { name: "15" })).toHaveAttribute("href", "/mentions?b=1&sentiment=negative");
    expect(screen.queryByRole("link", { name: "65" })).toBeNull();
  });

  it("zero-count cells are not links", async () => {
    const data = sentimentFixture();
    const first = data.timeseries?.data[0];
    if (first) first.negative = 0;
    render(<SentimentOverTimeChart data={data} timezone="Asia/Ho_Chi_Minh" getSegmentHref={getSegmentHref} />);
    await openTable();
    expect(screen.queryByRole("link", { name: "0" })).toBeNull();
  });

  it("no getSegmentHref → no links", async () => {
    render(<SentimentOverTimeChart data={sentimentFixture()} timezone="Asia/Ho_Chi_Minh" />);
    await openTable();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
