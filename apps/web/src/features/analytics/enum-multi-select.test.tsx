import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EnumMultiSelect } from "./enum-multi-select";

const items = [
  { id: "positive", label: "Tích cực" },
  { id: "negative", label: "Tiêu cực" },
];

describe("EnumMultiSelect", () => {
  it("TC-DASH-005: picking an option reports the new array", async () => {
    const onChange = vi.fn();
    render(<EnumMultiSelect label="Cảm xúc" items={items} value={[]} onChange={onChange} />);
    await act(async () => fireEvent.click(screen.getByRole("button")));
    await act(async () => fireEvent.click(await screen.findByRole("option", { name: /tiêu cực/i })));
    expect(onChange).toHaveBeenLastCalledWith(["negative"]);
  });
});
