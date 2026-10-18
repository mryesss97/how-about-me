import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UpdatedAgo, updatedAgoText } from "./updated-ago";

afterEach(() => vi.useRealTimers());

describe("UpdatedAgo (TC-SYS-001)", () => {
  it("ticks every second", () => {
    vi.useFakeTimers();
    const t0 = Date.now();
    render(<UpdatedAgo updatedAt={t0} />);
    expect(screen.getByText("Cập nhật 0 giây trước")).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(12_000));
    expect(screen.getByText("Cập nhật 12 giây trước")).toBeInTheDocument();
  });

  it("switches to minutes after 60 s", () => {
    expect(updatedAgoText(0, 125_000)).toBe("Cập nhật 2 phút trước");
  });
});
