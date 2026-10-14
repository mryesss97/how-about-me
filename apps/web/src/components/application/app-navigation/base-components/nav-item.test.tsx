import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NavItemBase } from "./nav-item";

// #274: on the sky sign the active item is a white enamel plate with navy lettering (was Sky Tint, #245).
describe("NavItemBase active style", () => {
  it("current link becomes the white plate with aria-current", () => {
    render(
      <NavItemBase type="link" href="/mentions" current>
        Mentions
      </NavItemBase>,
    );
    const link = screen.getByRole("link", { name: "Mentions" });
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link.className).toContain("bg-[var(--enamel-white)]");
    expect(screen.getByText("Mentions").className).toContain("text-[var(--ink)]");
  });

  it("current collapsible-child gets the same plate", () => {
    render(
      <NavItemBase type="collapsible-child" href="/settings/project" current>
        Project
      </NavItemBase>,
    );
    const link = screen.getByRole("link", { name: "Project" });
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link.className).toContain("bg-[var(--enamel-white)]");
  });

  it("non-current link keeps the neutral style", () => {
    render(
      <NavItemBase type="link" href="/overview">
        Overview
      </NavItemBase>,
    );
    expect(screen.getByRole("link", { name: "Overview" }).className).not.toContain("bg-[var(--enamel-white)]");
  });
});
