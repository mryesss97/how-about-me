import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TopicSentimentTable } from "./topic-sentiment-table";
import { topicSentimentFixture } from "./topic-sentiment-fixture.test-utils";

const getCellHref = (t: string, s: string | null) => `/mentions?topic=${t}${s ? `&sentiment=${s}` : ""}`;
const rows = () => topicSentimentFixture().rows;

/** T-149 / #336 — FR-144, FR-142, NFR-030, BR-017; TC-DASH-027. Cells now live in the sentiment map's "Bảng" view. */
describe("TopicSentimentTable (#336)", () => {
  it("NFR-030: every cell prints count · share within the row; rows keep the given order", () => {
    render(<TopicSentimentTable caption="Bản đồ" rows={rows()} getCellHref={getCellHref} />);
    const headers = screen.getAllByRole("rowheader").map((h) => h.textContent);
    expect(headers).toHaveLength(12);
    // #327: row header also carries the mobile-only total line.
    expect(headers[0]).toBe("Vé4 có cảm xúc");
    expect(screen.getByRole("link", { name: /^Vé · Tiêu cực: 2 lượt nhắc, 50,0% trên 4/ })).toHaveTextContent(
      "2 · 50,0%",
    );
  });

  it("FR-142: non-zero cells link to topic&sentiment (incl. `other`), zero cells are plain text", () => {
    render(<TopicSentimentTable caption="Bản đồ" rows={rows()} getCellHref={getCellHref} />);
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

  it("#327 / BR-017: columns run Tiêu cực → Trung tính → Tích cực and every cell prints its count", () => {
    const { container } = render(<TopicSentimentTable caption="Bản đồ" rows={rows()} getCellHref={getCellHref} />);
    const cols = [...container.querySelectorAll("thead th")].map((th) => th.textContent);
    expect(cols.slice(1, 4)).toEqual(["Tiêu cực", "Trung tính", "Tích cực"]);
    const firstRowCells = [...container.querySelectorAll("tbody tr:first-child td")].slice(0, 3);
    expect(firstRowCells.map((td) => td.textContent)).toEqual(["2 · 50,0%", "1 · 25,0%", "1 · 25,0%"]);
  });
});
