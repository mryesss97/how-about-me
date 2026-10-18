import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { addTerm, TermInput } from "./term-input";

function Harness({ initial = [] as string[] }) {
  const [v, setV] = useState(initial);
  return <TermInput label="Loại trừ" value={v} onChange={setV} />;
}

describe("TermInput (FR-052)", () => {
  it("adds with Enter and with a comma, trimmed", () => {
    render(<Harness />);
    const input = screen.getByLabelText("Loại trừ");
    fireEvent.change(input, { target: { value: "  spam " } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.change(input, { target: { value: "ads," } });
    expect(screen.getByRole("button", { name: "Xoá spam" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xoá ads" })).toBeInTheDocument();
  });

  it("skips empty and case-insensitive duplicates", () => {
    expect(addTerm(["Spam"], "spam")).toEqual(["Spam"]);
    expect(addTerm(["Spam"], "  ")).toEqual(["Spam"]);
  });

  it("removes a tag", () => {
    render(<Harness initial={["spam", "ads"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Xoá spam" }));
    expect(screen.queryByRole("button", { name: "Xoá spam" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xoá ads" })).toBeInTheDocument();
  });
});
