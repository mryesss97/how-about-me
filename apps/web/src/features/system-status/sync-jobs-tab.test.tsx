import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ClientModule from "@/lib/api/client";
import { jobFixture, uuid } from "./fixtures.test-utils";
import { SyncJobsTab } from "./sync-jobs-tab";

const PID = "11111111-1111-4111-8111-111111111111";
const apiFetch = vi.fn();
const replace = vi.fn();
let search = "";

vi.mock("@/lib/api/client", async (orig) => ({
  ...(await orig<typeof ClientModule>()),
  apiFetch: (...a: unknown[]) => apiFetch(...a),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/system-status",
  useSearchParams: () => new URLSearchParams(search),
}));

type Call = [string, { params?: Record<string, string | undefined> }];
const jobsCalls = () => (apiFetch.mock.calls as Call[]).filter(([p]) => p.endsWith("/sync-jobs"));

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <SyncJobsTab pid={PID} tz="Asia/Ho_Chi_Minh" isAdmin={false} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  apiFetch.mockReset();
  replace.mockReset();
  search = "tab=sync-jobs";
});

function mockApi(jobs = [jobFixture()]) {
  apiFetch.mockImplementation((path: string) => {
    if (path.endsWith("/listening-queries")) return Promise.resolve({ items: [], nextCursor: null });
    if (path.endsWith("/sync-jobs")) return Promise.resolve({ items: jobs, nextCursor: null });
    return new Promise(() => {});
  });
}

/** Minimal ListeningQuery for `useQueryNames` (no cross-feature fixture import). */
const namedQuery = (id: string) => ({
  id,
  displayName: "1zone",
  queryValue: "1zone",
  queryType: "keyword",
  searchMode: "KEYWORD",
  scheduledSearchType: "RECENT",
  enabled: true,
  excludeTerms: [],
  includeTerms: [],
  pollIntervalSeconds: 600,
  overlapSeconds: 1200,
  initialBackfillDays: 1,
  nextRunAt: null,
  lastRunAt: null,
  lastSuccessfulSyncAt: null,
  lastError: null,
  lastJob: null,
  matchedPosts: { total: 0, last24h: 0 },
  createdBy: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  deletedAt: null,
});

describe("SyncJobsTab (TC-SYS-013)", () => {
  it("sends URL filters to the API with day bounds converted to UTC", async () => {
    search = `tab=sync-jobs&status=failed&queryId=${uuid(500)}&from=2026-10-13&to=2026-10-13`;
    mockApi();
    setup();
    await waitFor(() => expect(jobsCalls().length).toBe(1));
    expect(jobsCalls()[0]?.[1].params).toMatchObject({
      status: "failed",
      queryId: uuid(500),
      from: "2026-10-12T17:00:00.000Z",
      to: "2026-10-13T16:59:59.999Z",
    });
  });

  it("changing a filter writes the URL and drops the open job", async () => {
    search = "tab=sync-jobs&job=abc";
    mockApi();
    setup();
    fireEvent.change(await screen.findByLabelText(/^Trạng thái/), { target: { value: "failed" } });
    expect(replace).toHaveBeenCalledWith("/system-status?tab=sync-jobs&status=failed", { scroll: false });
  });

  it("shows the empty state", async () => {
    mockApi([]);
    setup();
    expect(await screen.findByText("Chưa có lượt đồng bộ nào khớp bộ lọc")).toBeInTheDocument();
  });

  it("clicking a row opens the drawer via ?job=", async () => {
    const job = jobFixture({ queryId: null, status: "failed", error: { code: "INTERNAL", message: "x" } });
    mockApi([job]);
    setup();
    const t = within(await screen.findByRole("table"));
    expect(t.getAllByText("Lỗi").length).toBeGreaterThan(0);
    fireEvent.click(t.getByText("Tất cả truy vấn"));
    expect(replace).toHaveBeenCalledWith(`/system-status?tab=sync-jobs&job=${job.id}`, { scroll: false });
  });

  it("#343: quick plaque 'Lỗi' writes status=failed; selection follows the URL; 'Tất cả' clears it", async () => {
    mockApi();
    const { unmount } = setup();
    const group = within(await screen.findByRole("group", { name: "Lọc nhanh theo trạng thái" }));
    expect(group.getByRole("button", { name: "Tất cả" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(group.getByRole("button", { name: "Lỗi" }));
    expect(replace).toHaveBeenCalledWith("/system-status?tab=sync-jobs&status=failed", { scroll: false });
    unmount();
    replace.mockReset();
    search = "tab=sync-jobs&status=failed";
    setup();
    const g2 = within(await screen.findByRole("group", { name: "Lọc nhanh theo trạng thái" }));
    expect(g2.getByRole("button", { name: "Lỗi" })).toHaveAttribute("data-selected", "true");
    expect(g2.getByRole("button", { name: "Tất cả" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(g2.getByRole("button", { name: "Tất cả" }));
    expect(replace).toHaveBeenCalledWith("/system-status?tab=sync-jobs", { scroll: false });
  });

  it("#343: a select-only status (cancelled) lights no quick plaque", async () => {
    search = "tab=sync-jobs&status=cancelled";
    mockApi();
    setup();
    const group = within(await screen.findByRole("group", { name: "Lọc nhanh theo trạng thái" }));
    for (const b of group.getAllByRole("button")) expect(b).toHaveAttribute("aria-pressed", "false");
  });

  it("#343: 'Bộ lọc · n' counts panel fields and toggles aria-expanded", async () => {
    search = `tab=sync-jobs&queryId=${uuid(500)}&from=2026-10-01`;
    mockApi();
    setup();
    const toggle = await screen.findByRole("button", { name: "Bộ lọc · 2" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("#343: 'Làm mới' refetches the job list", async () => {
    mockApi();
    setup();
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Làm mới" }));
    await waitFor(() => expect(jobsCalls().length).toBe(2));
  });

  it("#343: the query name links to its job history without opening the drawer (click or Enter)", async () => {
    const job = jobFixture();
    apiFetch.mockImplementation((path: string) => {
      if (path.endsWith("/listening-queries"))
        return Promise.resolve({ items: [namedQuery(uuid(500))], nextCursor: null });
      if (path.endsWith("/sync-jobs")) return Promise.resolve({ items: [job], nextCursor: null });
      return new Promise(() => {});
    });
    setup();
    const t = within(await screen.findByRole("table"));
    const link = await t.findByRole("link", { name: "Xem các lượt đồng bộ của 1zone" });
    expect(link).toHaveAttribute("href", `/system-status?tab=sync-jobs&queryId=${uuid(500)}`);
    // jsdom cannot navigate; block the default only (React handlers still run).
    link.addEventListener("click", (e) => e.preventDefault());
    fireEvent.keyDown(link, { key: "Enter" });
    fireEvent.click(link);
    expect(replace).not.toHaveBeenCalledWith(expect.stringContaining("job="), expect.anything());
  });

  it("#343 BR-017: mobile card shows a status plate and a worded error; tapping it opens the drawer", async () => {
    const job = jobFixture({ status: "failed", error: { code: "INTERNAL", message: "x" } });
    mockApi([job]);
    setup();
    const card = within(await screen.findByTestId(`job-card-${job.id}`));
    expect(card.getByText("Lỗi")).toBeInTheDocument();
    expect(card.getByText(/40 lấy · 10 mới · 5 cập nhật/)).toBeInTheDocument();
    fireEvent.click(card.getByRole("button", { name: /xem chi tiết/ }));
    expect(replace).toHaveBeenCalledWith(`/system-status?tab=sync-jobs&job=${job.id}`, { scroll: false });
  });
});
