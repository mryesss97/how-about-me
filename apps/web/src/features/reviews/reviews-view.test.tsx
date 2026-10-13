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
vi.mock("@/features/mentions/detail/mention-detail", () => ({ MentionDetail: () => <p>detail body</p> }));
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

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ReviewsView />
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
    expect(screen.getByText("1,234")).toBeInTheDocument();
    expect(listCalls()[0]?.[1].params).toMatchObject({ status: "unreviewed", count: "true" });
    fireEvent.click(screen.getByRole("tab", { name: /Failed/ }));
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
    expect(screen.queryByText("1,234")).toBeNull();
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
    fireEvent.click(screen.getByLabelText(`Select item by ${items[0]?.username}`));
    fireEvent.click(screen.getByLabelText(`Select item by ${items[1]?.username}`));
    fireEvent.click(screen.getByRole("button", { name: "Mark reviewed (2)" }));
    await waitFor(() => expect(screen.getAllByTestId("review-row")).toHaveLength(1));
    expect(JSON.parse(markCalls()[0]?.[1].body ?? "{}")).toEqual({ postIds: [items[0]?.id, items[1]?.id] });
    resolve({ marked: 2 });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Marked 2 reviewed"));
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
    fireEvent.click(screen.getByLabelText(`Select item by ${items[0]?.username}`));
    fireEvent.click(screen.getByRole("button", { name: "Mark reviewed (1)" }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(screen.getAllByTestId("review-row")).toHaveLength(2);
  });

  it("select all is capped at 50 (MARK_REVIEWED_MAX)", async () => {
    serve(Array.from({ length: 60 }, () => reviewFixture()));
    setup();
    await waitFor(() => expect(screen.getAllByTestId("review-row")).toHaveLength(60));
    fireEvent.click(screen.getByLabelText("Select all"));
    expect(screen.getByRole("button", { name: "Mark reviewed (50)" })).toBeInTheDocument();
    expect(screen.getByText("Up to 50 at a time")).toBeInTheDocument();
  });

  it("FR-015: viewer sees the queue without checkboxes or Mark reviewed", async () => {
    role = "viewer";
    serve();
    setup();
    await waitFor(() => expect(screen.getAllByTestId("review-row")).toHaveLength(2));
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /Mark reviewed/ })).toBeNull();
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
    expect(screen.queryByRole("button", { name: /Mark reviewed/ })).toBeNull();
    fireEvent.click(screen.getByRole("switch"));
    expect(replace).toHaveBeenCalledWith("/reviews");
  });

  it("failed rows show errorCode; confidence shows % and band (BR-020)", async () => {
    serve([reviewFixture({ reasons: ["failed"], analysis: { status: "failed", errorCode: "LLM_TIMEOUT" } })]);
    setup();
    expect(await screen.findByText("LLM_TIMEOUT")).toBeInTheDocument();
    const row = screen.getByTestId("review-row");
    expect(within(row).getByText("42.0%")).toBeInTheDocument();
    expect(within(row).getByText("low")).toBeInTheDocument();
  });

  it("clicking a row opens ?item= (push, Back closes)", async () => {
    const item = reviewFixture();
    serve([item]);
    setup();
    fireEvent.click(await screen.findByTestId("review-row"));
    expect(push).toHaveBeenCalledWith(`/reviews?item=${item.id}`);
  });

  it("slide-out Mark reviewed posts 1 id and closes", async () => {
    const item = reviewFixture();
    search = `item=${item.id}`;
    serve([item]);
    setup();
    expect(await screen.findByText("detail body")).toBeInTheDocument();
    apiFetch.mockImplementation((path: string) =>
      path.endsWith("/mark-reviewed")
        ? Promise.resolve({ marked: 1 })
        : Promise.resolve({ items: [], nextCursor: null, counts }),
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.click(await within(dialog).findByRole("button", { name: "Mark reviewed" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/reviews"));
    expect(JSON.parse(markCalls()[0]?.[1].body ?? "{}")).toEqual({ postIds: [item.id] });
  });

  it("empty state", async () => {
    serve([]);
    setup();
    expect(await screen.findByText("No items need review")).toBeInTheDocument();
  });

  it("error state with retry", async () => {
    apiFetch.mockRejectedValue(new ApiError(500, "INTERNAL", "Boom", "req-9"));
    setup();
    expect(await screen.findByText(/req-9/)).toBeInTheDocument();
  });
});
