import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NEGATIVE_SHARE_NOTE, NegativeTopicsChart } from "./negative-topics-chart";
import { openTable } from "./table-utils.test-utils";
import { emptyTopicSentiment, topicSentimentFixture } from "./topic-sentiment-fixture.test-utils";

/** T-149 — FR-144 negative-topic contributors, FR-142, BR-032; TC-DASH-027. */
describe("NegativeTopicsChart (T-149)", () => {
  it("FR-144: only topics with negative > 0, ranked negative desc then negativeShare desc", async () => {
    render(<NegativeTopicsChart data={topicSentimentFixture()} />);
    const [header, ...rows] = await openTable();
    expect(header).toEqual(["Chủ đề", "Tiêu cực", "Có cảm xúc", "Tỷ lệ tiêu cực"]);
    expect(rows).toEqual([
      ["Địa điểm", "2", "2", "100,0%"],
      ["Vé", "2", "4", "50,0%"],
      ["Khác", "1", "1", "100,0%"],
      ["Giá", "1", "4", "25,0%"],
    ]);
  });

  it("FR-142: rows link to topic&sentiment=negative drill-down", async () => {
    const getHref = (t: string) => `/mentions?topic=${t}&sentiment=negative`;
    render(<NegativeTopicsChart data={topicSentimentFixture()} getHref={getHref} onNavigate={() => {}} />);
    await openTable();
    expect(screen.getByRole("link", { name: "Khác" })).toHaveAttribute(
      "href",
      "/mentions?topic=other&sentiment=negative",
    );
  });

  it("shows the per-topic denominator note", () => {
    render(<NegativeTopicsChart data={topicSentimentFixture()} />);
    expect(screen.getByText(NEGATIVE_SHARE_NOTE)).toBeInTheDocument();
  });

  it("BR-032: no negative mentions → empty state", () => {
    render(<NegativeTopicsChart data={emptyTopicSentiment()} />);
    expect(screen.getByText("Không có lượt nhắc tiêu cực trong khoảng này")).toBeInTheDocument();
  });

  it("loading hides the table toggle; error shows request ID and Retry", () => {
    const { unmount } = render(<NegativeTopicsChart isLoading />);
    expect(screen.queryByRole("button", { name: "Xem dạng bảng" })).toBeNull();
    unmount();
    const onRetry = vi.fn();
    render(<NegativeTopicsChart error={{ code: "INTERNAL", message: "boom", requestId: "req-8" }} onRetry={onRetry} />);
    expect(screen.getByText(/req-8/)).toBeInTheDocument();
    screen.getByRole("button", { name: /thử lại/i }).click();
    expect(onRetry).toHaveBeenCalled();
  });
});
