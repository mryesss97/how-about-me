import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { statusFixture } from "./fixtures.test-utils";
import { OverviewCards } from "./overview-cards";

const TZ = "Asia/Ho_Chi_Minh";

describe("OverviewCards (TC-SYS-001)", () => {
  it("renders the four cards with text status plates (BR-017)", () => {
    render(<OverviewCards data={statusFixture()} tz={TZ} isAdmin={false} />);
    for (const name of ["Kết nối Threads", "Bộ thu thập", "Bộ phân tích", "Cơ sở dữ liệu"])
      expect(screen.getByRole("region", { name })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Kết nối Threads" })).getByText("Đã kết nối")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Bộ thu thập" })).getByText("12 phút")).toBeInTheDocument();
    expect(screen.getByText("12.345")).toBeInTheDocument();
  });

  it("'Quản lý' plaque link only for admins", () => {
    const { rerender } = render(<OverviewCards data={statusFixture()} tz={TZ} isAdmin={false} />);
    expect(screen.queryByRole("link", { name: "Quản lý" })).not.toBeInTheDocument();
    rerender(<OverviewCards data={statusFixture()} tz={TZ} isAdmin />);
    expect(screen.getByRole("link", { name: "Quản lý" })).toHaveAttribute("href", "/settings/integrations");
  });

  it("shows open circuit, null values as —, and the last Threads error", () => {
    const base = statusFixture();
    render(
      <OverviewCards
        data={{
          ...base,
          threads: {
            ...base.threads,
            status: "expired",
            lastError: { code: "THREADS_UNAUTHORIZED", message: "bad", at: base.generatedAt },
          },
          collector: {
            ...base.collector,
            successRate24h: null,
            circuit: { open: true, until: "2026-10-13T04:00:00.000Z", reason: "rate limit" },
          },
        }}
        tz={TZ}
        isAdmin={false}
      />,
    );
    expect(screen.getByRole("note")).toHaveTextContent("rate limit");
    expect(screen.getByText("Lỗi: token hết hạn")).toBeInTheDocument();
    expect(screen.getByText(/THREADS_UNAUTHORIZED: bad/)).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  // TC-SYS-004 / BR-017: analyzer plate is shown as text, not colour only.
  it.each([
    ["healthy", "Hoạt động tốt"],
    ["degraded", "Chậm"],
    ["budget_paused", "Tạm dừng (ngân sách)"],
  ] as const)("analyzer plate %s → %s", (status, label) => {
    const base = statusFixture();
    render(<OverviewCards data={{ ...base, analysis: { ...base.analysis, status } }} tz={TZ} isAdmin={false} />);
    expect(within(screen.getByRole("region", { name: "Bộ phân tích" })).getByText(label)).toBeInTheDocument();
  });

  it("links to the analysis failures tab only when failed24h > 0", () => {
    const base = statusFixture();
    const { rerender } = render(
      <OverviewCards data={{ ...base, analysis: { ...base.analysis, failed24h: 0 } }} tz={TZ} isAdmin={false} />,
    );
    expect(screen.queryByRole("link", { name: "Xem lỗi" })).not.toBeInTheDocument();
    rerender(<OverviewCards data={base} tz={TZ} isAdmin={false} />);
    expect(screen.getByRole("link", { name: "Xem lỗi" })).toHaveAttribute(
      "href",
      "/system-status?tab=analysis-failures",
    );
  });

  // #342 acceptance.
  const healthy = () => {
    const b = statusFixture();
    return {
      ...b,
      collector: { ...b.collector, failedJobs24h: 0, partialJobs24h: 0 },
      analysis: { ...b.analysis, failed24h: 0 },
    };
  };

  it("#342: healthy → green enamel plate and the normal summary sentence (BR-017 text kept)", () => {
    render(<OverviewCards data={healthy()} tz={TZ} isAdmin={false} queriesWithError={0} />);
    expect(screen.getByText("Mọi bộ phận hoạt động bình thường.")).toBeInTheDocument();
    const plate = within(screen.getByRole("region", { name: "Bộ thu thập" })).getByText("Hoạt động tốt");
    expect(plate).toHaveAttribute("data-tone", "success");
    expect(plate).toHaveClass("status-plate");
    expect(screen.queryByRole("link", { name: "Xem lượt lỗi" })).not.toBeInTheDocument();
  });

  it("#342: token expiring in 4 days → 'Sắp hết hạn', '(còn 4 ngày)', admin 'Cập nhật token' plaque", () => {
    const base = statusFixture();
    const data = { ...base, threads: { ...base.threads, tokenExpiresAt: "2026-10-17T03:00:00.000Z" } };
    const { rerender } = render(<OverviewCards data={data} tz={TZ} isAdmin />);
    const card = within(screen.getByRole("region", { name: "Kết nối Threads" }));
    expect(card.getByText("Sắp hết hạn")).toHaveAttribute("data-tone", "warning");
    expect(card.getByText(/\(còn 4 ngày\)/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cập nhật token" })).toHaveAttribute("href", "/settings/integrations");
    expect(screen.getByRole("link", { name: "token Threads hết hạn sau 4 ngày" })).toBeInTheDocument();
    rerender(<OverviewCards data={data} tz={TZ} isAdmin={false} />);
    expect(screen.queryByRole("link", { name: "Cập nhật token" })).not.toBeInTheDocument();
    expect(screen.getByText(/token Threads hết hạn sau 4 ngày/)).toBeInTheDocument();
  });

  it("#342: collector failures → 'Xem lượt lỗi' plaque to failed jobs; paused plate is red with text", () => {
    const base = statusFixture();
    render(
      <OverviewCards data={{ ...base, collector: { ...base.collector, status: "paused" } }} tz={TZ} isAdmin={false} />,
    );
    expect(screen.getByRole("link", { name: "Xem lượt lỗi" })).toHaveAttribute(
      "href",
      "/system-status?tab=sync-jobs&status=failed",
    );
    expect(within(screen.getByRole("region", { name: "Bộ thu thập" })).getByText("Tạm dừng")).toHaveAttribute(
      "data-tone",
      "error",
    );
  });

  it("#342: 'Truy vấn đang lỗi' hidden when not loaded, links when > 0", () => {
    const { rerender } = render(<OverviewCards data={statusFixture()} tz={TZ} isAdmin={false} />);
    expect(screen.queryByText("Truy vấn đang lỗi")).not.toBeInTheDocument();
    rerender(<OverviewCards data={statusFixture()} tz={TZ} isAdmin={false} queriesWithError={2} />);
    expect(screen.getByText("Truy vấn đang lỗi")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "2" })).toHaveAttribute("href", "/listening-queries");
  });

  it("#342: database labels '(ước tính)', migration admin-only, versions not doubled", () => {
    const base = statusFixture();
    const data = {
      ...base,
      analysis: { ...base.analysis, versions: { ...base.analysis.versions, taxonomyVersion: "taxonomy-v1" } },
    };
    const { rerender } = render(<OverviewCards data={data} tz={TZ} isAdmin={false} />);
    expect(screen.getByText("Bài nhắc (ước tính)")).toBeInTheDocument();
    expect(screen.queryByText("Cập nhật CSDL cuối (kỹ thuật)")).not.toBeInTheDocument();
    expect(screen.getByText("gpt-x · prompt p1 · taxonomy-v1")).toBeInTheDocument();
    rerender(<OverviewCards data={data} tz={TZ} isAdmin />);
    expect(screen.getByText("Cập nhật CSDL cuối (kỹ thuật)")).toBeInTheDocument();
  });

  it("#342: a Threads error older than the last success is grey with 'đã kết nối lại'", () => {
    const base = statusFixture();
    const data = {
      ...base,
      threads: { ...base.threads, lastError: { code: "E", message: "old", at: "2026-10-12T00:00:00.000Z" } },
    };
    render(<OverviewCards data={data} tz={TZ} isAdmin={false} />);
    expect(screen.getByText(/E: old/)).toHaveClass("text-tertiary");
    expect(screen.getByText(/đã kết nối lại/)).toBeInTheDocument();
  });
});
