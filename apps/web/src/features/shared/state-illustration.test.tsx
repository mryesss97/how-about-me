import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState, QueryState } from "./query-state";
import { StateIllustration, type StateIllustrationName } from "./state-illustration";

const srcs = (c: HTMLElement) => Array.from(c.querySelectorAll("img")).map((i) => i.getAttribute("src"));

describe("StateIllustration (#245, UX §2.3)", () => {
  it.each<StateIllustrationName>(["empty", "pending", "sync-attention"])("%s swaps light/dark files", (name) => {
    const { container } = render(<StateIllustration name={name} />);
    expect(srcs(container)).toEqual([`/brand/illustrations/${name}.svg`, `/brand/illustrations/${name}-dark.svg`]);
    for (const img of container.querySelectorAll("img")) expect(img).toHaveAttribute("alt", "");
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("EmptyState default keeps the compact icon (chart cards), no illustration", () => {
    const { container } = render(<EmptyState title="Nothing" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("EmptyState illustration opt-in renders the brand image with title/description", () => {
    const { container } = render(<EmptyState illustration="empty" title="Nothing" description="Widen" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Nothing")).toBeInTheDocument();
    expect(screen.getByText("Widen")).toBeInTheDocument();
    expect(srcs(container)).toContain("/brand/illustrations/empty.svg");
  });

  it("BR-032: QueryState passes emptyIllustration to empty only; error stays an ErrorState without image", () => {
    const { container, rerender } = render(
      <QueryState isEmpty emptyIllustration="empty">
        <p>x</p>
      </QueryState>,
    );
    expect(srcs(container)).toContain("/brand/illustrations/empty.svg");
    rerender(
      <QueryState error={{ code: "INTERNAL" }} emptyIllustration="empty">
        <p>x</p>
      </QueryState>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });
});
