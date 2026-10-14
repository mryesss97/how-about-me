import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { bannersFor, OverviewBanners } from "./overview-banners";
import { overviewFixture } from "./overview-fixture.test-utils";

const dq = (patch: Partial<ReturnType<typeof overviewFixture>["dataQuality"]>) => {
  const f = overviewFixture();
  return { ...f, dataQuality: { ...f.dataQuality, ...patch } };
};

describe("OverviewBanners (FR-134)", () => {
  it("healthy data shows no banner", () => {
    const { container } = render(<OverviewBanners data={overviewFixture()} canManage />);
    expect(container).toBeEmptyDOMElement();
  });

  it("TC-DASH-009: pending 124 shows the analysis-pending banner; 0 shows none", () => {
    const f = overviewFixture();
    render(<OverviewBanners data={{ ...f, coverage: { ...f.coverage, pendingMentions: 124 } }} canManage={false} />);
    expect(screen.getByText("124 lượt nhắc đang chờ phân tích.")).toBeInTheDocument();
    expect(bannersFor(f)).toEqual([]);
  });

  it("TC-DASH-010: failed or partial sync shows sync banner linking to System Status", () => {
    render(<OverviewBanners data={dq({ lastSyncStatus: "failed" })} canManage={false} />);
    expect(screen.getByText("Lần đồng bộ Threads gần nhất bị lỗi. Dữ liệu có thể chưa đầy đủ.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Xem trạng thái hệ thống" })).toHaveAttribute("href", "/system-status");
    expect(bannersFor(dq({ lastSyncStatus: "partial" }))).toEqual(["sync"]);
  });

  it("TC-DASH-011 / BR-033: integration banner links to Integrations for admins only", () => {
    const { rerender } = render(<OverviewBanners data={dq({ integrationStatus: "expired" })} canManage />);
    expect(screen.getByRole("alert")).toHaveTextContent("Kết nối Threads cần được xử lý.");
    expect(screen.getByRole("link", { name: "Đến trang Tích hợp" })).toHaveAttribute("href", "/settings/integrations");
    rerender(<OverviewBanners data={dq({ integrationStatus: "expired" })} canManage={false} />);
    expect(screen.queryByRole("link", { name: "Đến trang Tích hợp" })).toBeNull();
  });

  it("orders banners red → yellow → blue", () => {
    const f = dq({ integrationStatus: "permission_error", lastSyncStatus: "failed" });
    expect(bannersFor({ ...f, coverage: { ...f.coverage, pendingMentions: 1 } })).toEqual([
      "integration",
      "sync",
      "pending",
    ]);
  });
});
