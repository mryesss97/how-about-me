import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { detailFixture, overrideFixture } from "./fixtures.test-utils";
import { OverrideDialog, REASON_MAX } from "./override-form";

function setup(over: Parameters<typeof detailFixture>[0] = {}, isPending = false) {
  const onSubmit = vi.fn();
  render(
    <OverrideDialog mention={detailFixture(over)} isOpen onClose={vi.fn()} onSubmit={onSubmit} isPending={isPending} />,
  );
  const dialog = screen.getByRole("dialog");
  const selects = () => within(dialog).getAllByRole("combobox") as HTMLSelectElement[];
  const save = () => within(dialog).getByRole("button", { name: /Lưu ghi đè/ });
  const reason = () => within(dialog).getByRole("textbox") as HTMLTextAreaElement;
  return { dialog, selects, save, reason, onSubmit };
}

// FR-191: field, value, reason. TC-REV-001: sentiment negative → neutral with reason.
describe("OverrideDialog (FR-191)", () => {
  it("submits { field: sentiment, value: neutral, reason } (TC-REV-001)", () => {
    const { selects, save, reason, onSubmit } = setup();
    expect(selects()[1].value).toBe("negative");
    fireEvent.change(selects()[1], { target: { value: "neutral" } });
    expect(save()).toBeDisabled(); // reason required in the UI
    fireEvent.change(reason(), { target: { value: "  Sarcasm  " } });
    fireEvent.click(save());
    expect(onSubmit).toHaveBeenCalledWith(
      { field: "sentiment", value: "neutral", reason: "Sarcasm" },
      { followUp: false },
    );
  });

  it("Save is disabled while the value equals the current effective value", () => {
    const { save, reason } = setup();
    fireEvent.change(reason(), { target: { value: "why" } });
    expect(save()).toBeDisabled();
  });

  it("switching field swaps the value options to that enum", () => {
    const { selects } = setup();
    fireEvent.change(selects()[0], { target: { value: "safety_level" } });
    const values = Array.from(selects()[1].options).map((o) => o.value);
    expect(values).toEqual(["", "safe", "sensitive", "severe"]);
  });

  it("intents use a multi-select checkbox list", () => {
    const { selects, dialog, reason, save, onSubmit } = setup();
    fireEvent.change(selects()[0], { target: { value: "intents" } });
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Phàn nàn" }));
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Câu hỏi" }));
    fireEvent.change(reason(), { target: { value: "both" } });
    fireEvent.click(save());
    expect(onSubmit).toHaveBeenCalledWith(
      { field: "intents", value: ["complaint", "question"], reason: "both" },
      { followUp: false },
    );
  });

  it("caps the reason at 500 characters", () => {
    const { reason } = setup();
    expect(reason()).toHaveAttribute("maxLength", String(REASON_MAX));
  });

  it("warns when an active override on the field will be replaced", () => {
    setup({ overrides: [overrideFixture()] });
    expect(screen.getByText("Lưu sẽ thay thế ghi đè hiện tại của chuyên viên.")).toBeInTheDocument();
  });

  it("disables Save while pending", () => {
    const { selects, reason, save } = setup({}, true);
    fireEvent.change(selects()[1], { target: { value: "neutral" } });
    fireEvent.change(reason(), { target: { value: "x" } });
    expect(save()).toBeDisabled();
  });

  it("#338: initialField=relevance preselects the field and its current value", () => {
    render(
      <OverrideDialog
        mention={detailFixture({ analysis: { relevance: { label: "uncertain", confidence: 0.5 } } })}
        isOpen
        initialField="relevance"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        isPending={false}
      />,
    );
    const selects = within(screen.getByRole("dialog")).getAllByRole("combobox") as HTMLSelectElement[];
    expect(selects[0].value).toBe("relevance");
    expect(selects[1].value).toBe("uncertain");
  });

  it("#338: initialField=intents shows the checkbox list with current labels ticked", () => {
    render(
      <OverrideDialog
        mention={detailFixture({ analysis: { intents: [{ label: "complaint", confidence: 0.9 }] } })}
        isOpen
        initialField="intents"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        isPending={false}
      />,
    );
    const checked = within(screen.getByRole("dialog"))
      .getAllByRole("checkbox")
      .filter((c) => (c as HTMLInputElement).checked);
    expect(checked).toHaveLength(1);
  });
});

// #339: Reviews slide-out offers "mark reviewed after saving" (checked by default).
describe("OverrideDialog followUp (#339)", () => {
  const renderWith = (followUp?: { label: string }) => {
    const onSubmit = vi.fn();
    render(
      <OverrideDialog
        mention={detailFixture()}
        isOpen
        onClose={vi.fn()}
        onSubmit={onSubmit}
        isPending={false}
        followUp={followUp}
      />,
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getAllByRole("combobox")[1] as HTMLSelectElement, { target: { value: "neutral" } });
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "ok" } });
    return { dialog, onSubmit };
  };

  it("checked by default → followUp true; unchecked → false", () => {
    const { dialog, onSubmit } = renderWith({ label: "Đánh dấu đã xem lại sau khi lưu" });
    const box = within(dialog).getByRole("checkbox", { name: "Đánh dấu đã xem lại sau khi lưu" });
    expect(box).toBeChecked();
    fireEvent.click(within(dialog).getByRole("button", { name: /Lưu ghi đè/ }));
    expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({ field: "sentiment" }), { followUp: true });
    fireEvent.click(box);
    fireEvent.click(within(dialog).getByRole("button", { name: /Lưu ghi đè/ }));
    expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({ field: "sentiment" }), { followUp: false });
  });

  it("without followUp (Mentions) → no checkbox", () => {
    const { dialog } = renderWith();
    expect(within(dialog).queryByRole("checkbox", { name: /sau khi lưu/ })).toBeNull();
  });
});
