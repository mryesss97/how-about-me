import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnalysisPendingBanner, IntegrationExpiredBanner, PageBanner, SyncFailedBanner } from "./page-banner";

describe("page banners (UX §2.3, BR-032)", () => {
  it("a failed sync warns that the data may be incomplete and links to System Status", () => {
    render(<SyncFailedBanner />);
    expect(screen.getByText(/Lần đồng bộ Threads gần nhất bị lỗi/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /trạng thái hệ thống/i })).toHaveAttribute("href", "/system-status");
  });

  it("pending analysis is its own state, with the count and a link to those mentions", () => {
    render(<AnalysisPendingBanner count={1240} />);
    expect(screen.getByText(/1.240 lượt nhắc đang chờ phân tích/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /lượt nhắc đang chờ/i })).toHaveAttribute(
      "href",
      "/mentions?analysisStatus=pending",
    );
  });

  it("uses the singular form for one pending mention and hides itself at zero", () => {
    const { rerender, container } = render(<AnalysisPendingBanner count={1} />);
    expect(screen.getByText(/1 lượt nhắc đang chờ/i)).toBeInTheDocument();

    rerender(<AnalysisPendingBanner count={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("BR-033: only an admin gets the link to fix the Threads connection", () => {
    const { rerender } = render(<IntegrationExpiredBanner canManage />);
    expect(screen.getByRole("link", { name: /tích hợp/i })).toHaveAttribute("href", "/settings/integrations");

    rerender(<IntegrationExpiredBanner />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText(/nhờ quản trị dự án/i)).toBeInTheDocument();
  });

  it("an expired integration is an alert; softer states are polite status messages", () => {
    const { rerender } = render(<IntegrationExpiredBanner />);
    expect(screen.getByRole("alert")).toBeInTheDocument();

    rerender(<SyncFailedBanner />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("the generic banner renders any tone with a title and description", () => {
    render(<PageBanner tone="info" title="Heads up" description="Something worth knowing." />);
    expect(screen.getByText("Heads up")).toBeInTheDocument();
    expect(screen.getByText("Something worth knowing.")).toBeInTheDocument();
  });
});
