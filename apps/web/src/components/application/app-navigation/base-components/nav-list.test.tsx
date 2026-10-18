import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NavList } from "./nav-list";

const items = [
  { label: "One", href: "/one" },
  { label: "Two", href: "/two" },
];

// #325, BR-017: current is derived from activeUrl on every render, not snapshotted at mount.
describe("NavList", () => {
  it("moves aria-current when activeUrl changes", () => {
    const { rerender } = render(<NavList items={items} activeUrl="/one" />);
    expect(screen.getByRole("link", { name: "One" })).toHaveAttribute("aria-current", "page");
    rerender(<NavList items={items} activeUrl="/two" />);
    expect(screen.getByRole("link", { name: "One" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Two" })).toHaveAttribute("aria-current", "page");
  });

  it("marks nothing current without a match", () => {
    render(<NavList items={items} activeUrl={undefined} />);
    expect(screen.queryAllByRole("link").filter((l) => l.hasAttribute("aria-current"))).toHaveLength(0);
  });
});
