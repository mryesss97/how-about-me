import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import NotFound from "./not-found";

const back = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ back, push }) }));

const setHistoryLength = (n: number) => vi.spyOn(window.history, "length", "get").mockReturnValue(n);

describe("NotFound (#286, #350)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    back.mockClear();
    push.mockClear();
  });

  it("shows the Vietnamese heading", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { level: 1, name: "Không tìm thấy trang" })).toBeInTheDocument();
  });

  it("#350: shows the brand logo", () => {
    render(<NotFound />);
    expect(screen.getByRole("img", { name: "How About Me" })).toBeInTheDocument();
  });

  it("'Về trang chủ' links to / instead of going back", () => {
    render(<NotFound />);
    expect(screen.getByRole("link", { name: "Về trang chủ" })).toHaveAttribute("href", "/");
  });

  it("'Quay lại' calls router.back() when there is history", () => {
    setHistoryLength(3);
    render(<NotFound />);
    fireEvent.click(screen.getByRole("button", { name: "Quay lại" }));
    expect(back).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
  });

  it("#350: 'Quay lại' goes to / when opened in a new tab (history.length 1)", () => {
    setHistoryLength(1);
    render(<NotFound />);
    fireEvent.click(screen.getByRole("button", { name: "Quay lại" }));
    expect(push).toHaveBeenCalledWith("/");
    expect(back).not.toHaveBeenCalled();
  });
});
