import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageFrame } from "./page-frame";

describe("PageFrame (#348)", () => {
  it("gives every screen the same width and 24 px rhythm", () => {
    render(
      <PageFrame>
        <p>body</p>
      </PageFrame>,
    );
    const frame = screen.getByText("body").parentElement;
    expect(frame).toHaveClass("max-w-7xl", "gap-6", "px-4", "py-8", "lg:px-8");
  });
});
