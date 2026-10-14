import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NavItemBase } from "./nav-item";

// #245: active sidebar item uses Sky Tint (brand-100) + brand-700 text, not the global bg-secondary token.
describe("NavItemBase active style", () => {
  it("current link gets the brand tint and aria-current", () => {
    render(
      <NavItemBase type="link" href="/mentions" current>
        Mentions
      </NavItemBase>,
    );
    const link = screen.getByRole("link", { name: "Mentions" });
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link.className).toContain("bg-brand-100");
    expect(link.className).not.toContain("bg-secondary");
    expect(screen.getByText("Mentions").className).toContain("text-brand-700");
  });

  it("current collapsible-child gets the same tint", () => {
    render(
      <NavItemBase type="collapsible-child" href="/settings/project" current>
        Project
      </NavItemBase>,
    );
    const link = screen.getByRole("link", { name: "Project" });
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link.className).toContain("bg-brand-100");
  });

  it("non-current link keeps the neutral style", () => {
    render(
      <NavItemBase type="link" href="/overview">
        Overview
      </NavItemBase>,
    );
    expect(screen.getByRole("link", { name: "Overview" }).className).not.toContain("bg-brand-100");
  });
});
