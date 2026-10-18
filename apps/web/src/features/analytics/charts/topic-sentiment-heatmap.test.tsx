import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { openTable } from "./table-utils.test-utils";
import { TopicSentimentHeatmap } from "./topic-sentiment-heatmap";
import { emptyTopicSentiment, topicSentimentFixture } from "./topic-sentiment-fixture.test-utils";

const getCellHref = (t: string, s: string | null) => `/mentions?topic=${t}${s ? `&sentiment=${s}` : ""}`;

/** T-149 — FR-144, FR-142, NFR-030, NFR-032, BR-032; TC-DASH-027. */
describe("TopicSentimentHeatmap (T-149)", () => {
  it("NFR-030: every cell prints count · share within the row; all 12 topics in API order", () => {
    render(<TopicSentimentHeatmap data={topicSentimentFixture()} getCellHref={getCellHref} />);
    const headers = screen.getAllByRole("rowheader").map((h) => h.textContent);
    expect(headers).toHaveLength(12);
    // #327: row header also carries the mobile-only total line.
    expect(headers[0]).toBe("Vé4 có cảm xúc");
    expect(headers.at(-1)).toMatch(/^Khác/);
    expect(screen.getByRole("link", { name: /^Vé · Tiêu cực: 2 lượt nhắc, 50,0% trên 4/ })).toHaveTextContent(
      "2 · 50,0%",
    );
  });

  it("FR-142: non-zero cells link to topic&sentiment (incl. `other`), zero cells are plain text", () => {
    render(<TopicSentimentHeatmap data={topicSentimentFixture()} getCellHref={getCellHref} />);
    expect(screen.getByRole("link", { name: /^Vé · Tiêu cực/ })).toHaveAttribute(
      "href",
      "/mentions?topic=ticket&sentiment=negative",
    );
    expect(screen.getByRole("link", { name: /^Khác · Tiêu cực/ })).toHaveAttribute(
      "href",
      "/mentions?topic=other&sentiment=negative",
    );
    expect(screen.queryByRole("link", { name: /^Địa điểm · Positive/ })).toBeNull();
  });

  it("NFR-032: View as table lists every topic with row denominator and negative share; row header drills topic", async () => {
    render(<TopicSentimentHeatmap data={topicSentimentFixture()} getCellHref={getCellHref} />);
    const [header, ...rows] = await openTable();
    expect(header).toEqual(["Chủ đề", "Tiêu cực", "Trung tính", "Tích cực", "Có cảm xúc", "Tỷ lệ tiêu cực"]);
    expect(rows).toHaveLength(12);
    expect(rows[0]).toEqual(["Vé", "2", "1", "1", "4", "50,0%"]);
    expect(rows.map((r) => r[0])).not.toContain("Tổng");
    expect(screen.getByRole("link", { name: "Vé" })).toHaveAttribute("href", "/mentions?topic=ticket");
    expect(screen.queryByRole("link", { name: "Nghệ sĩ" })).toBeNull();
  });

  it("BR-032: every row total 0 → empty state", () => {
    render(<TopicSentimentHeatmap data={emptyTopicSentiment()} />);
    expect(screen.getByText("Chưa có lượt nhắc đã phân tích trong khoảng này")).toBeInTheDocument();
  });

  it("loading hides the table toggle; error shows request ID and Retry", () => {
    const { unmount } = render(<TopicSentimentHeatmap isLoading />);
    expect(screen.queryByRole("button", { name: "Xem dạng bảng" })).toBeNull();
    unmount();
    const onRetry = vi.fn();
    render(
      <TopicSentimentHeatmap error={{ code: "INTERNAL", message: "boom", requestId: "req-7" }} onRetry={onRetry} />,
    );
    expect(screen.getByText(/req-7/)).toBeInTheDocument();
    screen.getByRole("button", { name: /thử lại/i }).click();
    expect(onRetry).toHaveBeenCalled();
  });

  it("#327 / BR-017: columns run Tiêu cực → Trung tính → Tích cực and every cell prints its count", () => {
    const { container } = render(<TopicSentimentHeatmap data={topicSentimentFixture()} getCellHref={getCellHref} />);
    const cols = [...container.querySelectorAll("thead th")].map((th) => th.textContent);
    expect(cols.slice(1, 4)).toEqual(["Tiêu cực", "Trung tính", "Tích cực"]);
    const firstRowCells = [...container.querySelectorAll("tbody tr:first-child td")].slice(0, 3);
    expect(firstRowCells.map((td) => td.textContent)).toEqual(["2 · 50,0%", "1 · 25,0%", "1 · 25,0%"]);
  });
});
