import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TermNotFound from "./not-found";

describe("TermNotFound (#350, BR-041/BR-042)", () => {
  it("explains why the term is invalid and links home", () => {
    render(<TermNotFound />);
    expect(screen.getByRole("heading", { level: 1, name: "Cụm từ không hợp lệ" })).toBeInTheDocument();
    expect(screen.getByText(/1–60 ký tự/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Trang chủ" })).toHaveAttribute("href", "/");
  });
});
