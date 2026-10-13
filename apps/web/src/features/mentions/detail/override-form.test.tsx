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
  const save = () => within(dialog).getByRole("button", { name: /Save override/ });
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
    expect(onSubmit).toHaveBeenCalledWith({ field: "sentiment", value: "neutral", reason: "Sarcasm" });
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
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Complaint" }));
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Question" }));
    fireEvent.change(reason(), { target: { value: "both" } });
    fireEvent.click(save());
    expect(onSubmit).toHaveBeenCalledWith({ field: "intents", value: ["complaint", "question"], reason: "both" });
  });

  it("caps the reason at 500 characters", () => {
    const { reason } = setup();
    expect(reason()).toHaveAttribute("maxLength", String(REASON_MAX));
  });

  it("warns when an active override on the field will be replaced", () => {
    setup({ overrides: [overrideFixture()] });
    expect(screen.getByText("Saving replaces the current analyst override.")).toBeInTheDocument();
  });

  it("disables Save while pending", () => {
    const { selects, reason, save } = setup({}, true);
    fireEvent.change(selects()[1], { target: { value: "neutral" } });
    fireEvent.change(reason(), { target: { value: "x" } });
    expect(save()).toBeDisabled();
  });
});
