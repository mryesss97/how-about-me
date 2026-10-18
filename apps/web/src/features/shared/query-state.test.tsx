import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorState, QueryState } from "./query-state";

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
    expect(screen.getByText("Máy chủ gặp sự cố. Thử lại sau ít phút.")).toBeInTheDocument(); // #392
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
    expect(screen.getByRole("link", { name: /về tổng quan/i })).toBeInTheDocument();
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

  it("#348 BR-017: the error is an enamel board with a red keyline and the failure in words", () => {
    const { container } = render(<QueryState error={{ requestId: "r-1" }}>{CONTENT}</QueryState>);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveClass("operate-board");
    expect(alert).not.toHaveClass("rounded-xl");
    expect(container.querySelector(".sign-keyline--error")).not.toBeNull();
    expect(screen.getByText("Đã xảy ra lỗi khi tải dữ liệu.")).toBeInTheDocument();
    expect(screen.getByTestId("request-id")).toHaveTextContent("r-1");
  });

  it("#348: errorVariant='inline' drops the board for states inside a board", () => {
    render(
      <QueryState error={{}} errorVariant="inline">
        {CONTENT}
      </QueryState>,
    );
    expect(screen.getByRole("alert")).not.toHaveClass("operate-board");
    expect(screen.getByRole("alert")).toHaveClass("state-inline-error");
  });

  it("#348: forbidden is a keyline board with a plaque link back to Overview", () => {
    render(<QueryState isForbidden>{CONTENT}</QueryState>);
    expect(screen.getByRole("status")).toHaveClass("operate-board");
    const link = screen.getByRole("link", { name: "Về Tổng quan" });
    expect(link).toHaveAttribute("href", "/overview");
    expect(link).toHaveClass("plaque-button");
  });
});

describe("ErrorState copy (#392, UX §5)", () => {
  it("INTERNAL: Vietnamese sentence, requestId and code in the mono line, no English message", () => {
    const { container } = render(
      <ErrorState error={{ code: "INTERNAL", message: "Internal server error", requestId: "r1" }} />,
    );
    expect(container.textContent).not.toContain("Internal server error");
    expect(screen.getByText("Máy chủ gặp sự cố. Thử lại sau ít phút.")).toBeInTheDocument();
    expect(screen.getByTestId("request-id")).toHaveTextContent("r1");
    expect(container.textContent).toContain("INTERNAL");
  });

  it("NETWORK_ERROR: never prints 'Failed to fetch'", () => {
    const { container } = render(<ErrorState error={{ code: "NETWORK_ERROR", message: "Failed to fetch" }} />);
    expect(container.textContent).not.toContain("Failed");
    expect(screen.getByText("Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.")).toBeInTheDocument();
  });

  it("UNKNOWN without requestId: no 'Mã yêu cầu' line, no statusText", () => {
    const { container } = render(<ErrorState error={{ code: "UNKNOWN", message: "Internal Server Error" }} />);
    expect(container.textContent).not.toContain("Mã yêu cầu");
    expect(container.textContent).not.toContain("Internal Server Error");
    expect(screen.getByText("Máy chủ tạm thời không phản hồi. Thử lại sau ít phút.")).toBeInTheDocument();
  });

  it("production: no raw-message tooltip", () => {
    vi.stubEnv("NODE_ENV", "production");
    const { container } = render(<ErrorState error={{ code: "INTERNAL", message: "Internal server error" }} />);
    expect(container.querySelector("[title]")).toBeNull();
    vi.unstubAllEnvs();
  });
});
