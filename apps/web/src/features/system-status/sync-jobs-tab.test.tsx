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
    expect(await screen.findByText("Toàn cục")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("Thất bại")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Toàn cục"));
    expect(replace).toHaveBeenCalledWith(`/system-status?tab=sync-jobs&job=${job.id}`, { scroll: false });
  });
});
