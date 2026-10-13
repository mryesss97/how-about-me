import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { detailFixture } from "./fixtures.test-utils";
import { StatusBanner } from "./status-banner";

const failed = detailFixture({ analysis: { status: "failed", errorCode: "PROVIDER_TIMEOUT" } }).analysis;

describe("StatusBanner (FR-156, TC-MEN-014)", () => {
  it("failed: shows the error code and Retry for admin", () => {
    const onRetry = vi.fn();
    render(<StatusBanner analysis={failed} canRetry onRetry={onRetry} isRetrying={false} />);
    expect(screen.getByRole("alert")).toHaveTextContent("PROVIDER_TIMEOUT");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("failed: no Retry for non-admin (BR-033)", () => {
    render(<StatusBanner analysis={failed} canRetry={false} onRetry={vi.fn()} isRetrying={false} />);
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("pending: in-progress banner; completed: nothing", () => {
    const pending = detailFixture({ analysis: { status: "pending" } }).analysis;
    const { rerender } = render(<StatusBanner analysis={pending} canRetry onRetry={vi.fn()} isRetrying={false} />);
    expect(screen.getByText("Analysis in progress")).toBeInTheDocument();
    rerender(<StatusBanner analysis={detailFixture().analysis} canRetry onRetry={vi.fn()} isRetrying={false} />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
