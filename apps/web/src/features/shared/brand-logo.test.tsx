import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandLogo } from "./brand-logo";

describe("BrandLogo (#221 brand v2)", () => {
  it("exposes exactly one accessible name", () => {
    render(<BrandLogo />);
    expect(screen.getAllByRole("img", { name: "How About Me" })).toHaveLength(1);
  });

  it.each([
    ["horizontal", "logo-horizontal"],
    ["stacked", "logo-stacked"],
    ["mark", "mark"],
  ] as const)("variant %s uses the official primary + white files", (variant, file) => {
    const { container } = render(<BrandLogo variant={variant} />);
    const srcs = Array.from(container.querySelectorAll("img")).map((img) => img.getAttribute("src"));
    expect(srcs).toEqual([`/brand/${file}-primary.svg`, `/brand/${file}-white.svg`]);
  });

  it("hides the white variant in light mode and shows it only in dark mode", () => {
    const { container } = render(<BrandLogo />);
    const [primary, white] = Array.from(container.querySelectorAll("img"));
    expect(primary).toHaveClass("block", "dark:hidden");
    expect(white).toHaveClass("hidden", "dark:block");
    expect(white).toHaveAttribute("aria-hidden", "true");
  });
});
