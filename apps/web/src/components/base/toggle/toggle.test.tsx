import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Toggle } from "./toggle";

describe("Toggle (#386 N1, BR-017)", () => {
  it.each([false, true])("track never shrinks (slim=%s)", (slim) => {
    const { container } = render(<Toggle aria-label="Bật" slim={slim} label="Một nhãn rất dài có thể xuống dòng" />);
    expect(container.querySelector(".rounded-full.cursor-pointer")).toHaveClass("shrink-0");
  });
});
