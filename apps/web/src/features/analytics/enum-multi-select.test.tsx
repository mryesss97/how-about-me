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

  it("#329: trigger shows the label for one value and 'N đã chọn' for several", () => {
    const { rerender } = render(
      <EnumMultiSelect label="Cảm xúc" items={items} value={["negative"]} onChange={vi.fn()} />,
    );
    expect(screen.getByRole("button")).toHaveTextContent("Tiêu cực");
    rerender(<EnumMultiSelect label="Cảm xúc" items={items} value={["negative", "positive"]} onChange={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveTextContent("2 đã chọn");
    expect(screen.getByRole("button")).not.toHaveTextContent(/selected/);
  });

  it("#329: popover copy is Vietnamese", async () => {
    render(<EnumMultiSelect label="Cảm xúc" items={items} value={[]} onChange={vi.fn()} />);
    await act(async () => fireEvent.click(screen.getByRole("button")));
    expect(await screen.findByPlaceholderText("Tìm…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bỏ chọn" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chọn tất cả" })).toBeInTheDocument();
    await act(async () => fireEvent.change(screen.getByPlaceholderText("Tìm…"), { target: { value: "zzz" } }));
    expect(await screen.findByText("Không có kết quả")).toBeInTheDocument();
  });

  it("#385: the trigger's accessible name is label + value", () => {
    const { rerender } = render(<EnumMultiSelect label="Cảm xúc" items={items} value={[]} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^Cảm xúc/ })).toHaveAccessibleName(/^Cảm xúc .+/);
    rerender(<EnumMultiSelect label="Cảm xúc" items={items} value={["negative", "positive"]} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Cảm xúc 2 đã chọn" })).toBeInTheDocument();
  });
});
