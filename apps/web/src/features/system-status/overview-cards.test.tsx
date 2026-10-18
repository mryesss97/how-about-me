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

  it("'Quản lý' link only for admins", () => {
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
});
