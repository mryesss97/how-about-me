import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MentionDetailSlideout } from "./mention-detail-slideout";

const back = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back, push }),
  useSearchParams: () => new URLSearchParams("preset=7d"),
}));
// The body is covered by mention-detail.test.tsx.
vi.mock("./mention-detail", () => ({ MentionDetail: () => <p>body</p> }));

describe("MentionDetailSlideout (TC-MEN-009)", () => {
  it("Esc closes, navigates back to the list and returns focus to the row that opened it", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <button type="button">row</button>
      </QueryClientProvider>,
    );
    const row = screen.getByRole("button", { name: "row" });
    row.focus();
    render(<MentionDetailSlideout mentionId="00000000-0000-4000-8000-000000000001" />);
    expect(await screen.findByText("body")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open full page/ })).toHaveAttribute(
      "href",
      "/mentions/00000000-0000-4000-8000-000000000001?preset=7d",
    );
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByText("body")).toBeNull());
    expect(back.mock.calls.length + push.mock.calls.length).toBe(1);
    await waitFor(() => expect(row).toHaveFocus());
  });
});
