import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { detailFixture } from "./fixtures.test-utils";
import { StatusBanner } from "./status-banner";

const failed = detailFixture({ analysis: { status: "failed", errorCode: "ANALYSIS_PROVIDER_ERROR" } }).analysis;

describe("StatusBanner (FR-156, TC-MEN-014)", () => {
  it("failed: Vietnamese label + small raw code, and Retry when allowed (#338)", () => {
    const onRetry = vi.fn();
    render(<StatusBanner analysis={failed} canRetry onRetry={onRetry} isRetrying={false} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Bộ phân tích đang lỗi");
    expect(screen.getByRole("alert")).toHaveTextContent("Mã: ANALYSIS_PROVIDER_ERROR");
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("no Retry when canRetry=false (BR-033)", () => {
    render(<StatusBanner analysis={failed} canRetry={false} onRetry={vi.fn()} isRetrying={false} />);
    expect(screen.queryByRole("button", { name: "Thử lại" })).toBeNull();
  });

  it("pending: in-progress banner; completed: nothing", () => {
    const pending = detailFixture({ analysis: { status: "pending" } }).analysis;
    const { rerender } = render(<StatusBanner analysis={pending} canRetry onRetry={vi.fn()} isRetrying={false} />);
    expect(screen.getByText("Đang phân tích")).toBeInTheDocument();
    rerender(<StatusBanner analysis={detailFixture().analysis} canRetry onRetry={vi.fn()} isRetrying={false} />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
