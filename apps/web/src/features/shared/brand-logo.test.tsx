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
  ] as const)("variant %s renders only the primary file (light only, #260)", (variant, file) => {
    const { container } = render(<BrandLogo variant={variant} className="h-8" />);
    const imgs = Array.from(container.querySelectorAll("img"));
    expect(imgs.map((img) => img.getAttribute("src"))).toEqual([`/brand/${file}-primary.svg`]);
    expect(imgs[0]).toHaveClass("h-8");
    expect(imgs[0]?.className).not.toContain("dark:");
  });
});
