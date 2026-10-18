import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ClientModule from "@/lib/api/client";
import { overviewFixture } from "@/features/shared/overview-fixture.test-utils";
import { flattenUnique, isRejectedCursor } from "./api";
import { mentionFixture } from "./fixtures.test-utils";
import { MentionsView } from "./mentions-view";

const PID = "11111111-1111-4111-8111-111111111111";
const apiFetch = vi.fn();
const push = vi.fn();

vi.mock("@/lib/api/client", async (orig) => ({
  ...(await orig<typeof ClientModule>()),
  apiFetch: (...a: unknown[]) => apiFetch(...a),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams("preset=7d"),
}));
vi.mock("@/features/auth/use-current-project", () => ({ useCurrentProject: () => ({ project: { id: PID } }) }));
let roleState: { role: string; settings: { allowViewerExport: boolean } | null } = { role: "analyst", settings: null };
vi.mock("@/features/auth/use-role", () => ({ useRole: () => roleState }));
// Banners use overview data; keep these tests focused on the list.
let overviewData: unknown;
const useOverview = vi.fn((_pid: unknown, _params: Record<string, string>) => ({ data: overviewData }));
vi.mock("@/features/shared/use-overview", () => ({
  useOverview: (pid: unknown, params: Record<string, string>) => useOverview(pid, params),
}));

/** Index with a failing assertion instead of a non-null assertion. */
function nth<T>(arr: readonly T[], i: number): T {
  const v = arr.at(i);
  if (v === undefined) throw new Error(`no element at ${i}`);
  return v;
}

type Call = [string, { params: Record<string, string> }];
const listCalls = () => (apiFetch.mock.calls as Call[]).filter(([p]) => p.endsWith("/mentions"));

function page(n: number, nextCursor: string | null, totalCount?: number) {
  return { items: Array.from({ length: n }, () => mentionFixture()), nextCursor, totalCount };
}

function setup(search = "") {
  const onUrlUpdate = vi.fn<(e: UrlUpdateEvent) => void>();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <NuqsTestingAdapter searchParams={search} onUrlUpdate={onUrlUpdate} hasMemory>
        <MentionsView />
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
  return { lastQuery: () => onUrlUpdate.mock.calls.at(-1)?.[0].queryString ?? "" };
}

beforeEach(() => {
  roleState = { role: "analyst", settings: null };
  apiFetch.mockReset();
  push.mockReset();
  useOverview.mockClear();
  overviewData = undefined;
});

describe("MentionsView (UX §3.3)", () => {
  it.each([
    ["admin", true],
    ["analyst", false],
    ["viewer", false],
  ] as const)("T-146 / FR-196: %s sees bulk Re-analyze → %s", async (role, visible) => {
    roleState = { role, settings: { allowViewerExport: true } };
    apiFetch.mockResolvedValueOnce(page(1, null, 1));
    setup();
    await waitFor(() => expect(screen.getAllByTestId("mention-row")).toHaveLength(1));
    expect(screen.queryByRole("button", { name: /phân tích lại/i }) !== null).toBe(visible);
  });

  it.each([
    ["admin", false, true],
    ["viewer", false, false],
    ["viewer", true, true],
  ] as const)("T-147 / FR-032: %s (allowViewerExport=%s) sees Export CSV → %s", async (role, allow, visible) => {
    roleState = { role, settings: { allowViewerExport: allow } };
    apiFetch.mockResolvedValueOnce(page(1, null, 1));
    setup();
    await waitFor(() => expect(screen.getAllByTestId("mention-row")).toHaveLength(1));
    expect(screen.queryByRole("button", { name: /xuất csv/i }) !== null).toBe(visible);
  });

  it("TC-MEN-001 / BR-016: first page has 25 rows, count=true, relevance=relevant, sort=newest, total shown", async () => {
    apiFetch.mockResolvedValueOnce(page(25, "c1", 1234));
    setup();
    await waitFor(() => expect(screen.getAllByTestId("mention-row")).toHaveLength(25));
    const [path, { params }] = nth(listCalls(), 0);
    expect(path).toBe(`/projects/${PID}/mentions`);
    expect(params).toMatchObject({ limit: "25", count: "true", relevance: "relevant", sort: "newest" });
    expect(params.cursor).toBeUndefined();
    expect(screen.getByTestId("mentions-count")).toHaveTextContent("1.234 bài nhắc");
  });

  it("T-095: totalCount omitted → header shows loaded rows as a lower bound, no endless skeleton", async () => {
    apiFetch.mockResolvedValueOnce(page(3, "c1"));
    setup();
    await waitFor(() => expect(screen.getByTestId("mentions-count")).toHaveTextContent("Đã tải 3+ bài nhắc"));
  });

  it("T-095: totalCount omitted on the last page → the loaded count is exact", async () => {
    apiFetch.mockResolvedValueOnce(page(3, null));
    setup();
    await waitFor(() => expect(screen.getByTestId("mentions-count")).toHaveTextContent(/^3 bài nhắc$/));
  });

  it("relative preset: a new minute does not reset loaded pages; Load more keeps the pinned window", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-13T09:00:10Z") });
    try {
      apiFetch.mockResolvedValueOnce(page(25, "c1", 30)).mockResolvedValueOnce(page(5, null));
      setup();
      await waitFor(() => expect(screen.getAllByTestId("mention-row")).toHaveLength(25));
      vi.setSystemTime(new Date("2026-10-13T09:03:00Z"));
      await act(async () => fireEvent.click(screen.getByRole("button", { name: "Tải thêm" })));
      await waitFor(() => expect(screen.getAllByTestId("mention-row")).toHaveLength(30));
      expect(listCalls()).toHaveLength(2);
      const [first, second] = [nth(listCalls(), 0)[1].params, nth(listCalls(), 1)[1].params];
      expect(second.cursor).toBe("c1");
      expect(second.to).toBe(first.to);
      expect(second.from).toBe(first.from);
    } finally {
      vi.useRealTimers();
    }
  });

  it("TC-MEN-003: Load more appends, sends the cursor without count, dedupes by id", async () => {
    const first = page(25, "c1", 30);
    const dup = nth(first.items, 24);
    apiFetch
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce({ items: [dup, ...page(4, null).items], nextCursor: null });
    setup();
    await waitFor(() => expect(screen.getAllByTestId("mention-row")).toHaveLength(25));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Tải thêm" })));
    await waitFor(() => expect(screen.getAllByTestId("mention-row")).toHaveLength(29));
    const second = nth(listCalls(), 1)[1].params;
    expect(second.cursor).toBe("c1");
    expect(second.count).toBeUndefined();
    expect(screen.queryByRole("button", { name: "Tải thêm" })).toBeNull();
  });

  it("TC-MEN-005: URL filters are sent to the API", async () => {
    apiFetch.mockResolvedValue(page(1, null, 1));
    setup("?sentiment=negative&sort=oldest");
    await waitFor(() => expect(listCalls()).toHaveLength(1));
    expect(nth(listCalls(), 0)[1].params).toMatchObject({ sentiment: "negative", sort: "oldest" });
  });

  it("TC-MEN-007: changing sort writes `sort` to the URL and refetches", async () => {
    apiFetch.mockResolvedValue(page(1, null, 1));
    const { lastQuery } = setup();
    await waitFor(() => expect(listCalls()).toHaveLength(1));
    await act(async () =>
      fireEvent.change(screen.getByLabelText("Sắp xếp bài nhắc"), { target: { value: "safety_desc" } }),
    );
    // nuqs flushes URL updates via a timer queue → wait instead of asserting synchronously (#237)
    await waitFor(() => expect(lastQuery()).toContain("sort=safety_desc"));
    await waitFor(() => expect(nth(listCalls(), -1)[1].params.sort).toBe("safety_desc"));
  });

  it("TC-MEN-006: search is debounced 400 ms into URL `q`; clearing removes `q`", async () => {
    apiFetch.mockResolvedValue(page(1, null, 1));
    const { lastQuery } = setup();
    await waitFor(() => expect(listCalls()).toHaveLength(1));
    vi.useFakeTimers();
    try {
      const box = screen.getByRole("searchbox");
      fireEvent.change(box, { target: { value: "giá vé" } });
      await act(async () => vi.advanceTimersByTime(399));
      expect(lastQuery()).not.toContain("q=");
      // +1 ms fires the debounce; nuqs then flushes the URL on its own throttle.
      await act(async () => vi.advanceTimersByTime(1));
      await act(async () => vi.advanceTimersByTime(100));
      expect(new URLSearchParams(lastQuery()).get("q")).toBe("giá vé");
      expect(nth(listCalls(), -1)[1].params.q).toBe("giá vé");
      fireEvent.change(box, { target: { value: "" } });
      await act(async () => vi.advanceTimersByTime(400));
      await act(async () => vi.advanceTimersByTime(100));
      expect(lastQuery()).not.toContain("q=");
    } finally {
      vi.useRealTimers();
    }
  });

  it("TC-MEN-017: empty state with widen CTA", async () => {
    apiFetch.mockResolvedValueOnce(page(0, null, 0));
    setup();
    expect(await screen.findByText("Không có lượt nhắc liên quan trong khoảng thời gian này.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mở rộng khoảng thời gian" })).toBeInTheDocument();
    // #245: page-level empty state uses the brand v2 illustration (decorative).
    expect(document.querySelector('img[src="/brand/illustrations/empty.svg"]')).not.toBeNull();
  });

  it("TC-MEN-017: error state shows requestId and Retry", async () => {
    const { ApiError } = await import("@/lib/api/client");
    apiFetch.mockRejectedValueOnce(new ApiError(500, "INTERNAL", "Boom", "req-42"));
    setup();
    expect(await screen.findByTestId("request-id")).toHaveTextContent("req-42");
    expect(screen.queryByTestId("mentions-count")).toBeNull();
    apiFetch.mockResolvedValueOnce(page(2, null, 2));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Thử lại" })));
    await waitFor(() => expect(screen.getAllByTestId("mention-row")).toHaveLength(2));
  });

  it("TC-MEN-017 / FR-159: sync-failed and analysis-pending banners are distinct from the empty state", async () => {
    const base = overviewFixture();
    overviewData = overviewFixture({
      coverage: { ...base.coverage, pendingMentions: 12 },
      dataQuality: { ...base.dataQuality, lastSyncStatus: "failed" },
    });
    apiFetch.mockResolvedValueOnce(page(0, null, 0));
    setup("?compare=true");
    // Empty state names the highest-priority cause (sync > pending), not the generic copy (FR-159, BR-032).
    expect(
      await screen.findByText("Lần đồng bộ Threads gần nhất bị lỗi, dữ liệu có thể chưa đầy đủ."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Không có lượt nhắc liên quan trong khoảng thời gian này.")).toBeNull();
    expect(screen.getByText("Lần đồng bộ Threads gần nhất bị lỗi. Dữ liệu có thể chưa đầy đủ.")).toBeInTheDocument();
    expect(screen.getByText("12 lượt nhắc đang chờ phân tích.")).toBeInTheDocument();
    // Banners need coverage only — no previous-period work.
    expect(nth(useOverview.mock.calls, -1)[1].compare).toBeUndefined();
  });

  it("#328: pending banner + empty state link keep the pinned range and ask for pending,processing", async () => {
    const base = overviewFixture();
    overviewData = overviewFixture({ coverage: { ...base.coverage, pendingMentions: 5 } });
    apiFetch.mockResolvedValueOnce(page(0, null, 0));
    setup("?sentiment=negative");
    await screen.findAllByText("5 lượt nhắc đang chờ phân tích.");
    await waitFor(() => expect(screen.getAllByRole("link", { name: "Xem lượt nhắc đang chờ" })).toHaveLength(2));
    const links = screen.getAllByRole("link", { name: "Xem lượt nhắc đang chờ" });
    for (const l of links) {
      const sp = new URLSearchParams((l.getAttribute("href") ?? "").split("?")[1]);
      expect(sp.get("analysisStatus")).toBe("pending,processing");
      expect(sp.get("preset")).toBe("custom");
      expect(sp.get("to")).toBeTruthy();
      expect(sp.has("sentiment")).toBe(false);
    }
  });

  it.each([
    ["pending", { pendingMentions: 1234 }, {}, "1.234 lượt nhắc đang chờ phân tích."],
    [
      "sync partial",
      {},
      { lastSyncStatus: "partial" },
      "Lần đồng bộ Threads gần nhất bị lỗi, dữ liệu có thể chưa đầy đủ.",
    ],
    ["integration", {}, { integrationStatus: "expired" }, "Kết nối Threads cần được kiểm tra."],
  ] as const)("TC-MEN-017 / FR-159: empty list caused by %s shows its own copy", async (_n, cov, dq, title) => {
    const base = overviewFixture();
    overviewData = overviewFixture({
      coverage: { ...base.coverage, ...cov },
      dataQuality: { ...base.dataQuality, ...dq },
    });
    apiFetch.mockResolvedValueOnce(page(0, null, 0));
    setup();
    const heading = await screen.findAllByText(title);
    expect(heading.length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Mở rộng khoảng thời gian" })).toBeNull();
  });

  it.each([
    ["admin", true],
    ["viewer", false],
  ] as const)("TC-MEN-017 / BR-033: integration empty state — %s sees settings link → %s", async (role, visible) => {
    roleState = { role, settings: null };
    const base = overviewFixture();
    overviewData = overviewFixture({ dataQuality: { ...base.dataQuality, integrationStatus: "expired" } });
    apiFetch.mockResolvedValueOnce(page(0, null, 0));
    setup();
    await screen.findByText("Kết nối Threads cần được kiểm tra.");
    expect(screen.queryByRole("link", { name: "Mở cài đặt kết nối" }) !== null).toBe(visible);
  });

  it("TC-MEN-017: a failed further page shows an inline error and keeps the loaded rows", async () => {
    const { ApiError } = await import("@/lib/api/client");
    apiFetch
      .mockResolvedValueOnce(page(25, "c1", 30))
      .mockRejectedValueOnce(new ApiError(503, "INTERNAL", "Boom", "req-77"));
    setup();
    await waitFor(() => expect(screen.getAllByTestId("mention-row")).toHaveLength(25));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Tải thêm" })));
    expect(await screen.findByTestId("request-id")).toHaveTextContent("req-77");
    expect(screen.getAllByTestId("mention-row")).toHaveLength(25);
    apiFetch.mockResolvedValueOnce(page(5, null));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Thử lại" })));
    await waitFor(() => expect(screen.getAllByTestId("mention-row")).toHaveLength(30));
  });

  it("#195: a rejected cursor on Load more resets to the first page instead of an error", async () => {
    const { ApiError } = await import("@/lib/api/client");
    apiFetch
      .mockResolvedValueOnce(page(25, "stale", 30))
      .mockRejectedValueOnce(new ApiError(400, "VALIDATION_ERROR", "Invalid cursor", "req-9", { path: "cursor" }))
      .mockResolvedValueOnce(page(25, "fresh", 30));
    setup();
    await waitFor(() => expect(screen.getAllByTestId("mention-row")).toHaveLength(25));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Tải thêm" })));
    await waitFor(() => expect(listCalls()).toHaveLength(3));
    const third = nth(listCalls(), 2)[1].params;
    expect(third.cursor).toBeUndefined();
    expect(third.count).toBe("true");
    await waitFor(() => expect(screen.getAllByTestId("mention-row")).toHaveLength(25));
    expect(screen.queryByTestId("request-id")).toBeNull();
    expect(screen.getByRole("button", { name: "Tải thêm" })).toBeEnabled();
  });

  it("TC-MEN-020: ↑/↓ moves focus between rows, Enter opens detail keeping filters", async () => {
    const data = page(3, null, 3);
    apiFetch.mockResolvedValueOnce(data);
    setup();
    const rows = await screen.findAllByTestId("mention-row");
    nth(rows, 0).focus();
    fireEvent.keyDown(nth(rows, 0), { key: "ArrowDown" });
    expect(document.activeElement).toBe(rows[1]);
    fireEvent.keyDown(nth(rows, 1), { key: "ArrowUp" });
    expect(document.activeElement).toBe(rows[0]);
    fireEvent.keyDown(nth(rows, 0), { key: "Enter" });
    expect(push).toHaveBeenCalledWith(`/mentions/${nth(data.items, 0).id}?preset=7d`);
  });
});

describe("isRejectedCursor (#195)", () => {
  it("matches 400 VALIDATION_ERROR on cursor only", async () => {
    const { ApiError } = await import("@/lib/api/client");
    expect(isRejectedCursor(new ApiError(400, "VALIDATION_ERROR", "x", "r", { path: "cursor" }))).toBe(true);
    expect(
      isRejectedCursor(
        new ApiError(400, "VALIDATION_ERROR", "x", "r", { issues: [{ path: "cursor", message: "m", code: "c" }] }),
      ),
    ).toBe(true);
    expect(isRejectedCursor(new ApiError(400, "VALIDATION_ERROR", "x", "r", { path: "limit" }))).toBe(false);
    expect(isRejectedCursor(new ApiError(500, "INTERNAL", "x", "r", { path: "cursor" }))).toBe(false);
    expect(isRejectedCursor(new Error("x"))).toBe(false);
  });
});

describe("flattenUnique (TC-MEN-003)", () => {
  it("keeps the first occurrence of each id across pages", () => {
    const a = mentionFixture();
    const b = mentionFixture();
    const out = flattenUnique([
      { items: [a, b], nextCursor: "x" },
      { items: [b, mentionFixture()], nextCursor: null },
    ]);
    expect(out.map((m) => m.id)).toEqual([a.id, b.id, nth(out, 2).id]);
    expect(new Set(out.map((m) => m.id)).size).toBe(3);
  });
});
