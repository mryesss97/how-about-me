import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { queryFixture } from "./fixtures.test-utils";
import { QueriesTable } from "./queries-table";

const NOW = new Date("2026-10-13T03:05:00.000Z");
const renderTable = (items = [queryFixture()], isAdmin = false) =>
  render(<QueriesTable items={items} tz="Asia/Ho_Chi_Minh" isAdmin={isAdmin} now={NOW} />);

describe("QueriesTable", () => {
  it("TC-LQ-019 / FR-061: renders every column with lastJob and matchedPosts figures", () => {
    const q = queryFixture({ queryType: "topic_tag", queryValue: "concert" });
    renderTable([q]);
    for (const h of [
      "Truy vấn",
      "Loại",
      "Bật",
      "Chu kỳ quét",
      "Chồng lấn",
      "Lần đồng bộ cuối",
      "Kết quả gần nhất",
      "Lỗi gần nhất",
      "Người tạo",
    ])
      expect(screen.getByRole("columnheader", { name: h })).toBeInTheDocument();
    const row = within(screen.getByTestId(`query-row-${q.id}`));
    expect(row.getByText("#concert")).toBeInTheDocument(); // BR-004
    expect(row.getByText("Chủ đề")).toBeInTheDocument();
    expect(row.getByText("10 phút")).toBeInTheDocument();
    expect(row.getByText("20 phút")).toBeInTheDocument();
    expect(row.getByText("Thành công")).toBeInTheDocument(); // BR-017
    expect(row.getByText("5 phút trước")).toBeInTheDocument();
    expect(row.getByText("1.234 lấy / 56 mới")).toBeInTheDocument();
    expect(row.getByText("12 / 4.321")).toBeInTheDocument();
    expect(row.getByText("An Admin")).toBeInTheDocument();
  });

  it("never-synced query shows 'Chưa đồng bộ' and dashes", () => {
    const q = queryFixture({ lastJob: null, lastSuccessfulSyncAt: null, lastRunAt: null, createdBy: null });
    renderTable([q]);
    const row = within(screen.getByTestId(`query-row-${q.id}`));
    expect(row.getByText("Chưa đồng bộ")).toBeInTheDocument();
    expect(row.getAllByText("—").length).toBeGreaterThanOrEqual(3);
  });

  it("known error codes read in Vietnamese; the tooltip keeps the full code: message", () => {
    const message = "Threads API rate limit exceeded for this token, retry after the window resets";
    const q = queryFixture({ lastError: { code: "THREADS_RATE_LIMITED", message, at: "2026-10-13T03:00:00.000Z" } });
    renderTable([q]);
    const trigger = screen.getByRole("button", { name: `THREADS_RATE_LIMITED: ${message}` });
    expect(trigger.textContent).toBe("Threads giới hạn tần suất gọi");
  });

  it("unknown error codes show the truncated provider message", () => {
    const message = "Something unexpected happened upstream while paging the search results, giving up";
    const q = queryFixture({ lastError: { code: "SOMETHING_NEW", message, at: "2026-10-13T03:00:00.000Z" } });
    renderTable([q]);
    const trigger = screen.getByRole("button", { name: `SOMETHING_NEW: ${message}` });
    expect(trigger.textContent?.endsWith("…")).toBe(true);
  });

  it("deleted rows are dimmed and carry an 'Đã xoá' badge", () => {
    const q = queryFixture({ deletedAt: "2026-10-13T00:00:00.000Z" });
    renderTable([q]);
    const tr = screen.getByTestId(`query-row-${q.id}`);
    expect(tr.className).toContain("opacity-60");
    expect(within(tr).getAllByText("Đã xoá").length).toBeGreaterThanOrEqual(1);
  });

  it("BR-033: viewer sees Bật/Tắt text, admin sees a (disabled until #43) switch", () => {
    const q = queryFixture({ enabled: false });
    const { unmount } = renderTable([q]);
    expect(within(screen.getByTestId(`query-row-${q.id}`)).getAllByText("Tắt").length).toBeGreaterThan(0);
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    unmount();
    renderTable([q], true);
    expect(screen.getByRole("switch", { name: `Bật ${q.displayName}` })).toBeDisabled();
  });

  it("#342: the sync status links to its job", () => {
    const q = queryFixture();
    renderTable([q]);
    expect(screen.getByRole("link", { name: "Thành công — xem lượt đồng bộ" })).toHaveAttribute(
      "href",
      `/system-status?tab=sync-jobs&job=${q.lastJob?.id}`,
    );
  });

  it("#342: an error re-synced since is grey with 'đã đồng bộ lại' and no job link", () => {
    const q = queryFixture({ lastError: { code: "X", message: "m", at: "2026-10-13T02:00:00.000Z" } });
    renderTable([q]);
    const row = within(screen.getByTestId(`query-row-${q.id}`));
    expect(row.getByText(/đã đồng bộ lại/)).toHaveClass("text-tertiary");
    expect(row.queryByRole("link", { name: "Xem lượt lỗi" })).not.toBeInTheDocument();
  });

  it("#342: a current error stays red and links to the failed job", () => {
    const q = queryFixture({
      lastSuccessfulSyncAt: "2026-10-12T00:00:00.000Z",
      lastError: { code: "X", message: "m", at: "2026-10-13T02:00:00.000Z" },
    });
    if (!q.lastJob) throw new Error("fixture has a last job");
    const job = { ...q.lastJob, status: "failed" as const };
    const failed = { ...q, lastJob: job };
    renderTable([failed]);
    const row = within(screen.getByTestId(`query-row-${q.id}`));
    expect(row.getByRole("button", { name: "X: m" })).toHaveClass("text-error-primary");
    expect(row.getByRole("link", { name: "Xem lượt lỗi" })).toHaveAttribute(
      "href",
      `/system-status?tab=sync-jobs&job=${job.id}`,
    );
  });
});
