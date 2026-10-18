import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { bannersFor, emptyReasonFor, OverviewBanners } from "./overview-banners";
import { overviewFixture } from "./overview-fixture.test-utils";

const strip = vi.hoisted(() => ({ notice: null as null | { kind: string } }));
vi.mock("@/features/shared/health-strip", () => ({
  useCollectionHealth: () => (strip.notice ? { notice: strip.notice, nav: null } : null),
}));

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

  it("#328: pendingHref is passed down to the pending banner link", () => {
    const f = overviewFixture();
    render(
      <OverviewBanners
        data={{ ...f, coverage: { ...f.coverage, pendingMentions: 2 } }}
        canManage={false}
        pendingHref="/mentions?x=1"
      />,
    );
    expect(screen.getByRole("link", { name: "Xem lượt nhắc đang chờ" })).toHaveAttribute("href", "/mentions?x=1");
  });

  it("TC-DASH-010: failed or partial sync shows sync banner linking to the failed sync jobs (#342)", () => {
    render(<OverviewBanners data={dq({ lastSyncStatus: "failed" })} canManage={false} />);
    expect(screen.getByText("Lần đồng bộ Threads gần nhất bị lỗi. Dữ liệu có thể chưa đầy đủ.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Xem lượt đồng bộ lỗi" })).toHaveAttribute(
      "href",
      "/system-status?tab=sync-jobs&status=failed",
    );
    expect(bannersFor(dq({ lastSyncStatus: "partial" }))).toEqual(["sync"]);
  });

  it("TC-DASH-011 / BR-033: integration banner links to Integrations for admins only", () => {
    const { rerender } = render(<OverviewBanners data={dq({ integrationStatus: "expired" })} canManage />);
    expect(screen.getByRole("alert")).toHaveTextContent("Kết nối Threads cần được xử lý.");
    expect(screen.getByRole("link", { name: "Đến trang Kết nối" })).toHaveAttribute("href", "/settings/integrations");
    rerender(<OverviewBanners data={dq({ integrationStatus: "expired" })} canManage={false} />);
    expect(screen.queryByRole("link", { name: "Đến trang Kết nối" })).toBeNull();
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

describe("emptyReasonFor (FR-159, BR-032)", () => {
  it("returns none for healthy or missing data", () => {
    expect(emptyReasonFor(overviewFixture())).toBe("none");
    expect(emptyReasonFor(undefined)).toBe("none");
  });

  it("maps each cause and keeps priority integration > sync > pending", () => {
    const f = overviewFixture();
    const pending = { ...f, coverage: { ...f.coverage, pendingMentions: 3 } };
    expect(emptyReasonFor(pending)).toBe("pending");
    const sync = { ...pending, dataQuality: { ...f.dataQuality, lastSyncStatus: "failed" as const } };
    expect(emptyReasonFor(sync)).toBe("sync");
    const integ = { ...sync, dataQuality: { ...sync.dataQuality, integrationStatus: "expired" as const } };
    expect(emptyReasonFor(integ)).toBe("integration");
  });
});

// #345: the shell strip already tells the integration is broken → no duplicate red banner while it shows.
describe("OverviewBanners with the shell strip (#345)", () => {
  it("drops the integration banner only while the strip shows a notice", () => {
    strip.notice = { kind: "threads" };
    const { rerender } = render(<OverviewBanners data={dq({ integrationStatus: "expired" })} canManage />);
    expect(screen.queryByText("Kết nối Threads cần được xử lý.")).toBeNull();
    strip.notice = null;
    rerender(<OverviewBanners data={dq({ integrationStatus: "expired", lastSyncStatus: "partial" })} canManage />);
    expect(screen.getByText("Kết nối Threads cần được xử lý.")).toBeInTheDocument();
  });
});
