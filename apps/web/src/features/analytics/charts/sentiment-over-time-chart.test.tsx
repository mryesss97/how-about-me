import { render } from "@testing-library/react";
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
