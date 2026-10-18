import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultFilters, type Filters } from "@/lib/filters";
import { CopyLinkButton } from "./copy-link-button";

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}));
let filters: Filters = defaultFilters("Asia/Ho_Chi_Minh");
vi.mock("@/lib/filters/use-filters", () => ({ useFilters: () => ({ filters }) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/overview" }));

const writeText = vi.fn();

beforeEach(() => {
  toastSuccess.mockReset();
  toastError.mockReset();
  writeText.mockReset();
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  filters = { ...defaultFilters("Asia/Ho_Chi_Minh"), sentiment: ["negative"] };
});

describe("CopyLinkButton (#349, FR-142)", () => {
  it("copies an absolute URL with the injected range pinned as custom and toasts the period", async () => {
    writeText.mockResolvedValue(undefined);
    // 12/10 00:00 → 20/10 00:00 Asia/Ho_Chi_Minh (exclusive end → last day 19/10).
    const range = { from: "2026-10-11T17:00:00.000Z", to: "2026-10-19T17:00:00.000Z" };
    render(<CopyLinkButton range={range} />);
    fireEvent.click(screen.getByRole("button", { name: "Sao chép liên kết" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Đã sao chép liên kết · 12/10–19/10"));
    const url = new URL(String(writeText.mock.calls[0]?.[0]));
    expect(url.origin).toBe(window.location.origin);
    expect(url.pathname).toBe("/overview");
    expect(url.searchParams.get("preset")).toBe("custom");
    expect(url.searchParams.get("from")).toBe(range.from);
    expect(url.searchParams.get("to")).toBe(range.to);
    expect(url.searchParams.get("sentiment")).toBe("negative");
  });

  it("clipboard rejected → error toast", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    render(<CopyLinkButton compact />);
    fireEvent.click(screen.getByRole("button", { name: "Sao chép liên kết" }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Lỗi: Không sao chép được. Hãy sao chép từ thanh địa chỉ."),
    );
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
