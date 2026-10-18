import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SectionTabs } from "./section-tabs";

const three = [
  { href: "/a", label: "A", current: true },
  { href: "/b", label: "B", current: false },
  { href: "/c", label: "C", current: false },
];

describe("SectionTabs (#386 N4, #348)", () => {
  it("renders links with aria-current on the current tab and 44 px targets", () => {
    render(<SectionTabs ariaLabel="Mục" items={three} />);
    expect(screen.getByRole("link", { name: "A" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "B" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "B" })).toHaveClass("plaque-button", "min-h-11");
  });

  it("uses a 2×2 grid under sm with ≥ 3 tabs, a wrapping row with ≤ 2", () => {
    const { rerender } = render(<SectionTabs ariaLabel="Mục" items={three} />);
    expect(screen.getByRole("navigation", { name: "Mục" })).toHaveClass("grid", "grid-cols-2");
    rerender(<SectionTabs ariaLabel="Mục" items={three.slice(0, 2)} />);
    const nav = screen.getByRole("navigation", { name: "Mục" });
    expect(nav).toHaveClass("flex", "flex-wrap");
    expect(nav).not.toHaveClass("grid");
  });

  it("calls onNavigate, which can cancel navigation (#347 guard)", () => {
    const onNavigate = vi.fn((_href: string, e: { preventDefault: () => void; defaultPrevented: boolean }) =>
      e.preventDefault(),
    );
    render(<SectionTabs ariaLabel="Mục" items={three} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("link", { name: "C" }));
    expect(onNavigate).toHaveBeenCalledWith("/c", expect.anything());
    expect(onNavigate.mock.calls[0]?.[1].defaultPrevented).toBe(true);
  });
});
