import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QueryState } from "./query-state";

const CONTENT = <p>62 mentions</p>;

describe("QueryState (UX §2.3, BR-032)", () => {
  it("renders the content when the query succeeded with data", () => {
    render(<QueryState>{CONTENT}</QueryState>);
    expect(screen.getByText("62 mentions")).toBeInTheDocument();
  });

  it("shows a skeleton — not a spinner — while loading, and announces it", () => {
    const { container } = render(<QueryState isLoading>{CONTENT}</QueryState>);
    expect(screen.queryByText("62 mentions")).not.toBeInTheDocument();
    expect(screen.getByText("Đang tải…")).toBeInTheDocument();
    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
  });

  it("distinguishes 'no data' from an error: empty shows the widen-the-range hint", () => {
    render(<QueryState isEmpty>{CONTENT}</QueryState>);
    expect(screen.getByText("Không có lượt nhắc liên quan trong khoảng thời gian này.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("accepts custom empty copy and a call to action", () => {
    render(
      <QueryState isEmpty emptyTitle="No listening queries yet." emptyAction={<button>Add query</button>}>
        {CONTENT}
      </QueryState>,
    );
    expect(screen.getByText("No listening queries yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add query" })).toBeInTheDocument();
  });

  it("surfaces the requestId on error — the first thing support asks for", () => {
    render(
      <QueryState error={{ code: "INTERNAL", message: "Analytics unavailable.", requestId: "req-abc-123" }}>
        {CONTENT}
      </QueryState>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Analytics unavailable.")).toBeInTheDocument();
    expect(screen.getByTestId("request-id")).toHaveTextContent("req-abc-123");
  });

  it("offers Retry only when a handler is given, and calls it", () => {
    const onRetry = vi.fn();
    const { rerender } = render(<QueryState error={{ code: "INTERNAL" }}>{CONTENT}</QueryState>);
    expect(screen.queryByRole("button", { name: /thử lại/i })).not.toBeInTheDocument();

    rerender(
      <QueryState error={{ code: "INTERNAL" }} onRetry={onRetry}>
        {CONTENT}
      </QueryState>,
    );
    fireEvent.click(screen.getByRole("button", { name: /thử lại/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("BR-033: a FORBIDDEN_* error renders the permission state, not a generic error", () => {
    render(<QueryState error={{ code: "FORBIDDEN_ROLE" }}>{CONTENT}</QueryState>);
    expect(screen.getByText(/không có quyền/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to overview/i })).toBeInTheDocument();
  });

  it("forbidden wins over loading, so a denied screen never flashes a skeleton first", () => {
    render(
      <QueryState isLoading isForbidden>
        {CONTENT}
      </QueryState>,
    );
    expect(screen.getByText(/không có quyền/i)).toBeInTheDocument();
    expect(screen.queryByText("Đang tải…")).not.toBeInTheDocument();
  });
});
