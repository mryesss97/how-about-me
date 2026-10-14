import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import NotFound from "./not-found";

const back = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ back }) }));

describe("NotFound (#286)", () => {
  it("shows the Vietnamese heading", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { level: 1, name: "Không tìm thấy trang" })).toBeInTheDocument();
  });

  it("'Về trang chủ' links to / instead of going back", () => {
    render(<NotFound />);
    expect(screen.getByRole("link", { name: "Về trang chủ" })).toHaveAttribute("href", "/");
  });

  it("'Quay lại' calls router.back()", () => {
    render(<NotFound />);
    fireEvent.click(screen.getByRole("button", { name: "Quay lại" }));
    expect(back).toHaveBeenCalledOnce();
  });
});
