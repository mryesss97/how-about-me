import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import type * as ClientModule from "@/lib/api/client";
import { reviewFixture } from "./fixtures.test-utils";
import { ReviewsView } from "./reviews-view";

const PID = "11111111-1111-4111-8111-111111111111";
const apiFetch = vi.fn();
const push = vi.fn();
const replace = vi.fn();
let search = "";
let role = "analyst";
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("@/lib/api/client", async (orig) => ({
  ...(await orig<typeof ClientModule>()),
  apiFetch: (...a: unknown[]) => apiFetch(...a),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("@/features/auth/use-current-project", () => ({ useCurrentProject: () => ({ project: { id: PID } }) }));
vi.mock("@/features/auth/use-role", () => ({ useRole: () => ({ role, settings: null }) }));
vi.mock("sonner", () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}));

type Call = [string, { params?: Record<string, string>; method?: string; body?: string }];
const calls = () => apiFetch.mock.calls as Call[];
const listCalls = () => calls().filter(([p]) => p.endsWith("/reviews"));
const markCalls = () => calls().filter(([p]) => p.endsWith("/mark-reviewed"));

const counts = { all: 1234, uncertain: 2, lowConfidence: 1, failed: 1 };

function serve(items = [reviewFixture(), reviewFixture()], extra: Record<string, unknown> = {}) {
  apiFetch.mockImplementation((path: string) => {
    if (path.endsWith("/reviews"))
      return Promise.resolve({ items, nextCursor: null, totalCount: items.length, counts, ...extra });
    return Promise.resolve({ marked: 0 });
  });
}

/** Table and cards render side by side (CSS picks, #339) — scope checkbox lookups to the table. */
const tableCheck = (name: string) => within(screen.getByRole("table")).getByLabelText(name);

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ReviewsView renderDetail={() => <p>detail body</p>} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  apiFetch.mockReset();
  push.mockReset();
  replace.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  search = "";
  role = "analyst";
});

describe("ReviewsView (UX §3.8, FR-195, TC-REV-007)", () => {
  it("tabs show count badges; clicking a tab sets ?reason", async () => {
    serve();
    setup();
    await waitFor(() => expect(screen.getAllByTestId("review-row")).toHaveLength(2));
    expect(screen.getByText(/1\.234/)).toBeInTheDocument();
    // #278 plaques, #352 a single-select toggle group (radio): the selected plaque is checked + data-selected.
    const all = screen.getByRole("radio", { name: /Tất cả/ });
    expect(all).toHaveAttribute("aria-checked", "true");
    expect(all).toHaveAttribute("data-selected");
    expect(listCalls()[0]?.[1].params).toMatchObject({ status: "unreviewed", count: "true" });
    fireEvent.click(screen.getByRole("radio", { name: /Phân tích lỗi/ }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/reviews?reason=failed"));
  });

  it("calls the API with reason from the URL", async () => {
    search = "reason=failed";
    serve();
    setup();
    await waitFor(() => expect(listCalls()[0]?.[1].params).toMatchObject({ reason: "failed" }));
  });

  it("hides badges when counts are absent (no fake 0)", async () => {
    serve([reviewFixture()], { counts: undefined });
    setup();
    await waitFor(() => expect(screen.getAllByTestId("review-row")).toHaveLength(1));
    expect(screen.queryByText(/1\.234/)).toBeNull();
  });

  it("BR-040: marks 2 rows — POST body, optimistic removal, success toast", async () => {
    const items = [reviewFixture(), reviewFixture(), reviewFixture()];
    serve(items);
    let resolve: (v: unknown) => void = () => {};
    setup();
    await waitFor(() => expect(screen.getAllByTestId("review-row")).toHaveLength(3));
    apiFetch.mockImplementation((path: string) =>
      path.endsWith("/mark-reviewed")
        ? new Promise((r) => (resolve = r))
        : Promise.resolve({ items: [items[2]], nextCursor: null, counts }),
    );
    fireEvent.click(tableCheck(`Chọn mục của @${items[0]?.username}`));
    fireEvent.click(tableCheck(`Chọn mục của @${items[1]?.username}`));
    fireEvent.click(screen.getByRole("button", { name: "Đánh dấu đã xem lại (2)" }));
    await waitFor(() => expect(screen.getAllByTestId("review-row")).toHaveLength(1));
    expect(JSON.parse(markCalls()[0]?.[1].body ?? "{}")).toEqual({ postIds: [items[0]?.id, items[1]?.id] });
    resolve({ marked: 2 });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Đã đánh dấu 2 mục đã xem lại"));
  });

  it("rolls back and toasts when mark-reviewed fails", async () => {
    const items = [reviewFixture(), reviewFixture()];
    serve(items);
    setup();
    await waitFor(() => expect(screen.getAllByTestId("review-row")).toHaveLength(2));
    apiFetch.mockImplementation((path: string) =>
      path.endsWith("/mark-reviewed")
        ? Promise.reject(new ApiError(403, "FORBIDDEN_ROLE", "Forbidden", "req-1"))
        : Promise.resolve({ items, nextCursor: null, counts }),
    );
    fireEvent.click(tableCheck(`Chọn mục của @${items[0]?.username}`));
    fireEvent.click(screen.getByRole("button", { name: "Đánh dấu đã xem lại (1)" }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(screen.getAllByTestId("review-row")).toHaveLength(2);
  });

  it("select all is capped at 50 (MARK_REVIEWED_MAX)", async () => {
    serve(Array.from({ length: 60 }, () => reviewFixture()));
    setup();
    await waitFor(() => expect(screen.getAllByTestId("review-row")).toHaveLength(60));
    fireEvent.click(tableCheck("Chọn tất cả"));
    // #339: the cap helper lives in the selection bar.
    const bar = screen.getByRole("region", { name: "Mục đã chọn" });
    expect(within(bar).getByRole("button", { name: "Đánh dấu đã xem lại (50)" })).toBeInTheDocument();
    expect(within(bar).getByText("Tối đa 50 mục mỗi lần")).toBeInTheDocument();
  });

  it("FR-015: viewer sees the queue without checkboxes or Mark reviewed", async () => {
    role = "viewer";
    serve();
    setup();
    await waitFor(() => expect(screen.getAllByTestId("review-row")).toHaveLength(2));
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /Đánh dấu đã xem lại/ })).toBeNull();
  });

  it("Show reviewed: status=reviewed, no mark action, reviewer shown", async () => {
    search = "status=reviewed";
    serve([
      reviewFixture({
        reviewedAt: "2026-10-13T04:00:00.000Z",
        reviewedBy: { id: "22222222-2222-4222-8222-222222222222", displayName: "Lan" },
      }),
    ]);
    setup();
    await waitFor(() => expect(screen.getByText("Lan")).toBeInTheDocument());
    expect(listCalls()[0]?.[1].params).toMatchObject({ status: "reviewed" });
    expect(screen.queryByRole("button", { name: /Đánh dấu đã xem lại/ })).toBeNull();
    fireEvent.click(screen.getByRole("switch", { name: "Hiện mục đã xem lại" }));
    expect(replace).toHaveBeenCalledWith("/reviews");
  });

  it("#338: failed rows show the Vietnamese error label (code in title), Lần trước:; confidence % and band (BR-020)", async () => {
    serve([reviewFixture({ reasons: ["failed"], analysis: { status: "failed", errorCode: "LLM_TIMEOUT" } })]);
    setup();
    const row = await screen.findByTestId("review-row");
    const label = within(row).getByText("Bộ phân tích phản hồi quá lâu");
    expect(label).toHaveAttribute("title", "LLM_TIMEOUT");
    expect(screen.queryByText("LLM_TIMEOUT")).toBeNull();
    expect(within(row).getAllByText("Lần trước:").length).toBeGreaterThan(0);
    expect(within(row).getByText("42,0%")).toBeInTheDocument();
    expect(within(row).getByText("Thấp")).toBeInTheDocument();
  });

  it("clicking a row opens ?item= (push, Back closes)", async () => {
    const item = reviewFixture();
    serve([item]);
    setup();
    fireEvent.click(await screen.findByTestId("review-row"));
    expect(push).toHaveBeenCalledWith(`/reviews?item=${item.id}`);
  });

  it("BR-040: slide-out Mark reviewed on the only item posts 1 id and closes", async () => {
    const item = reviewFixture();
    search = `item=${item.id}`;
    serve([item]);
    setup();
    expect(await screen.findByText("detail body")).toBeInTheDocument();
    // #344: one word for a mention — "Bài nhắc", never "Bài viết".
    expect(screen.getByRole("heading", { name: "Chi tiết bài nhắc" })).toBeInTheDocument();
    expect(screen.queryByText(/Bài viết/)).not.toBeInTheDocument();
    apiFetch.mockImplementation((path: string) =>
      path.endsWith("/mark-reviewed")
        ? Promise.resolve({ marked: 1 })
        : Promise.resolve({ items: [], nextCursor: null, counts }),
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.click(await within(dialog).findByRole("button", { name: "Đánh dấu đã xem lại" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/reviews"));
    expect(JSON.parse(markCalls()[0]?.[1].body ?? "{}")).toEqual({ postIds: [item.id] });
  });

  it("empty state", async () => {
    serve([]);
    setup();
    expect(await screen.findByText("Không có mục nào cần xem lại")).toBeInTheDocument();
  });

  it("error state with retry", async () => {
    apiFetch.mockRejectedValue(new ApiError(500, "INTERNAL", "Boom", "req-9"));
    setup();
    expect(await screen.findByText(/req-9/)).toBeInTheDocument();
  });

  describe("#339 selection bar, keyboard, slide-out flow", () => {
    it("UX §3.8: no idle (0) button; bar on select; Bỏ chọn and Esc clear", async () => {
      const items = [reviewFixture(), reviewFixture()];
      serve(items);
      setup();
      await waitFor(() => expect(screen.getAllByTestId("review-row")).toHaveLength(2));
      expect(screen.queryByRole("button", { name: /Đánh dấu đã xem lại/ })).toBeNull();
      fireEvent.click(tableCheck(`Chọn mục của @${items[0]?.username}`));
      const bar = screen.getByRole("region", { name: "Mục đã chọn" });
      expect(within(bar).getByText("1 mục đã chọn")).toBeInTheDocument();
      fireEvent.click(within(bar).getByRole("button", { name: "Bỏ chọn" }));
      expect(screen.queryByRole("region", { name: "Mục đã chọn" })).toBeNull();
      fireEvent.click(tableCheck(`Chọn mục của @${items[1]?.username}`));
      fireEvent.keyDown(document.body, { key: "Escape" });
      expect(screen.queryByRole("region", { name: "Mục đã chọn" })).toBeNull();
    });

    it("FR-015: viewer has no bar and no mark in the slide-out but can navigate", async () => {
      role = "viewer";
      const items = [reviewFixture(), reviewFixture()];
      search = `item=${items[0]?.id}`;
      serve(items);
      setup();
      const dialog = await screen.findByRole("dialog");
      await waitFor(() => expect(within(dialog).getByText("1 / 2")).toBeInTheDocument());
      expect(within(dialog).queryByRole("button", { name: /Đánh dấu đã xem lại/ })).toBeNull();
      fireEvent.click(within(dialog).getByRole("button", { name: "Mục sau" }));
      await waitFor(() => expect(replace).toHaveBeenCalledWith(`/reviews?item=${items[1]?.id}`));
    });

    it("rows: ↓/↑ move focus, Space toggles, Enter opens", async () => {
      const items = [reviewFixture(), reviewFixture()];
      serve(items);
      setup();
      await waitFor(() => expect(screen.getAllByTestId("review-row")).toHaveLength(2));
      const [r0, r1] = screen.getAllByTestId("review-row");
      r0?.focus();
      fireEvent.keyDown(r0 as HTMLElement, { key: "ArrowDown" });
      expect(document.activeElement).toBe(r1);
      fireEvent.keyDown(r1 as HTMLElement, { key: "ArrowUp" });
      expect(document.activeElement).toBe(r0);
      fireEvent.keyDown(r0 as HTMLElement, { key: " " });
      expect(screen.getByText("1 mục đã chọn")).toBeInTheDocument();
      fireEvent.keyDown(r0 as HTMLElement, { key: "Enter" });
      expect(push).toHaveBeenCalledWith(`/reviews?item=${items[0]?.id}`);
    });

    it("slide-out: n / N, J/K replace ?item, reasons under the title", async () => {
      const items = [reviewFixture(), reviewFixture({ reasons: ["uncertain", "low_confidence"] }), reviewFixture()];
      search = `item=${items[1]?.id}`;
      serve(items);
      setup();
      const dialog = await screen.findByRole("dialog");
      await waitFor(() => expect(within(dialog).getByText("2 / 3")).toBeInTheDocument());
      expect(within(dialog).getByText("Chưa chắc")).toBeInTheDocument();
      expect(within(dialog).getByText("42,0%")).toBeInTheDocument();
      const target = within(dialog).getByText("detail body");
      fireEvent.keyDown(target, { key: "j" });
      await waitFor(() => expect(replace).toHaveBeenLastCalledWith(`/reviews?item=${items[2]?.id}`));
      fireEvent.keyDown(target, { key: "k" });
      expect(replace).toHaveBeenLastCalledWith(`/reviews?item=${items[0]?.id}`);
      expect(within(dialog).getByRole("button", { name: "Mục trước" })).not.toBeDisabled();
    });

    it("› on the last loaded item loads the next page when there is one", async () => {
      const items = [reviewFixture(), reviewFixture()];
      const more = reviewFixture();
      search = `item=${items[1]?.id}`;
      apiFetch.mockImplementation((path: string, init: { params?: Record<string, string> }) =>
        Promise.resolve(
          init.params?.cursor
            ? { items: [more], nextCursor: null }
            : { items, nextCursor: "c2", totalCount: 3, counts },
        ),
      );
      setup();
      const dialog = await screen.findByRole("dialog");
      await waitFor(() => expect(within(dialog).getByText("2 / 2+")).toBeInTheDocument());
      fireEvent.click(within(dialog).getByRole("button", { name: "Mục sau" }));
      await waitFor(() => expect(replace).toHaveBeenCalledWith(`/reviews?item=${more.id}`));
    });

    it("BR-040 mark-and-next: posts 1 id then opens the next item (no close)", async () => {
      const items = [reviewFixture(), reviewFixture(), reviewFixture()];
      search = `item=${items[1]?.id}`;
      serve(items);
      setup();
      const dialog = await screen.findByRole("dialog");
      apiFetch.mockImplementation((path: string) =>
        path.endsWith("/mark-reviewed")
          ? Promise.resolve({ marked: 1 })
          : Promise.resolve({ items: [items[0], items[2]], nextCursor: null, counts }),
      );
      fireEvent.click(await within(dialog).findByRole("button", { name: "Đánh dấu đã xem lại · tiếp" }));
      await waitFor(() => expect(replace).toHaveBeenCalledWith(`/reviews?item=${items[2]?.id}`));
      expect(JSON.parse(markCalls()[0]?.[1].body ?? "{}")).toEqual({ postIds: [items[1]?.id] });
      expect(replace).not.toHaveBeenCalledWith("/reviews");
    });

    it("mark-and-next failure stays on the item and toasts (BR-040 rollback)", async () => {
      const items = [reviewFixture(), reviewFixture()];
      search = `item=${items[0]?.id}`;
      serve(items);
      setup();
      const dialog = await screen.findByRole("dialog");
      apiFetch.mockImplementation((path: string) =>
        path.endsWith("/mark-reviewed")
          ? Promise.reject(new ApiError(500, "INTERNAL", "Boom", "req-2"))
          : Promise.resolve({ items, nextCursor: null, counts }),
      );
      fireEvent.click(await within(dialog).findByRole("button", { name: "Đánh dấu đã xem lại · tiếp" }));
      await waitFor(() => expect(toastError).toHaveBeenCalled());
      expect(replace).not.toHaveBeenCalled();
      expect(screen.getAllByTestId("review-row")).toHaveLength(2);
    });

    it("J/K are ignored while typing in a text field", async () => {
      const items = [reviewFixture(), reviewFixture()];
      search = `item=${items[0]?.id}`;
      serve(items);
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      render(
        <QueryClientProvider client={qc}>
          <ReviewsView renderDetail={() => <textarea aria-label="Lý do" />} />
        </QueryClientProvider>,
      );
      const dialog = await screen.findByRole("dialog");
      await waitFor(() => expect(within(dialog).getByText("1 / 2")).toBeInTheDocument());
      fireEvent.keyDown(within(dialog).getByLabelText("Lý do"), { key: "j" });
      expect(replace).not.toHaveBeenCalled();
    });

    it("full page link returns to the same tab (?back=/reviews?reason=…)", async () => {
      const item = reviewFixture();
      search = `reason=uncertain&item=${item.id}`;
      serve([item]);
      setup();
      const dialog = await screen.findByRole("dialog");
      const link = within(dialog).getByRole("link", { name: "Mở trang đầy đủ" });
      expect(link).toHaveAttribute(
        "href",
        `/mentions/${item.id}?back=${encodeURIComponent("/reviews?reason=uncertain")}`,
      );
    });
  });
});
