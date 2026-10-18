import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { Plus } from "@untitledui/icons";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlaqueButton, plaqueClassName } from "./plaque-button";

const SRC = resolve(__dirname, "../..");

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return tsxFiles(p);
    return p.endsWith(".tsx") && !p.includes(".test.") ? [p] : [];
  });
}

describe("PlaqueButton (#330, BR-017)", () => {
  it("renders a native plaque button with a text label", () => {
    render(<PlaqueButton>Tải thêm</PlaqueButton>);
    const btn = screen.getByRole("button", { name: "Tải thêm" });
    expect(btn).toHaveClass("plaque-button");
    expect(btn).toHaveAttribute("type", "button");
  });

  it("renders a link when href is given", () => {
    render(<PlaqueButton href="/">Về trang chủ</PlaqueButton>);
    const link = screen.getByRole("link", { name: "Về trang chủ" });
    expect(link).toHaveAttribute("href", "/");
    expect(link).toHaveClass("plaque-button");
  });

  it("loading disables, sets aria-busy and keeps the accessible name", () => {
    render(<PlaqueButton isLoading>Tải thêm</PlaqueButton>);
    const btn = screen.getByRole("button", { name: "Tải thêm" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
  });

  it("isDisabled blocks onClick", () => {
    const onClick = vi.fn();
    render(
      <PlaqueButton isDisabled onClick={onClick}>
        Thử lại
      </PlaqueButton>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("hides the icon from assistive tech", () => {
    const { container } = render(<PlaqueButton iconLeading={Plus}>Mời thành viên</PlaqueButton>);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("guard: no broken `plaque` class or hand-rolled plaque buttons remain", () => {
    const offenders = tsxFiles(SRC).filter((f) => {
      if (f.endsWith("plaque-button.tsx")) return false;
      const s = readFileSync(f, "utf8");
      return s.includes('className="plaque"') || s.includes('"plaque-button inline-flex');
    });
    expect(offenders).toEqual([]);
  });
});

describe("PlaqueButton touch target (#386)", () => {
  it.each(["xs", "sm", "md"] as const)("size %s is ≥ 44 px under md", (size) => {
    render(<PlaqueButton size={size}>Nút {size}</PlaqueButton>);
    expect(screen.getByRole("button", { name: `Nút ${size}` })).toHaveClass("max-md:min-h-11");
  });

  it("plaqueClassName carries the same mobile min height", () => {
    expect(plaqueClassName("xs").split(" ")).toContain("max-md:min-h-11");
  });
});
