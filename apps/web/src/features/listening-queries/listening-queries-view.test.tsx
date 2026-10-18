import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ClientModule from "@/lib/api/client";
import { ApiError } from "@/lib/api/client";
import { queryFixture } from "./fixtures.test-utils";
import { ListeningQueriesView } from "./listening-queries-view";

const PID = "11111111-1111-4111-8111-111111111111";
const apiFetch = vi.fn();
const replace = vi.fn();
const push = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}));
let search = "";

vi.mock("@/lib/api/client", async (orig) => ({
  ...(await orig<typeof ClientModule>()),
  apiFetch: (...a: unknown[]) => apiFetch(...a),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => "/listening-queries",
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("@/features/auth/use-current-project", () => ({
  useCurrentProject: () => ({ project: { id: PID, timezone: "Asia/Ho_Chi_Minh" } }),
}));
let role = "viewer";
vi.mock("@/features/auth/use-role", () => ({
  useRole: () => ({ isLoading: false, hasRole: (rs: readonly string[]) => rs.includes(role) }),
}));

type Call = [string, { params: Record<string, string> }];

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ListeningQueriesView />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  apiFetch.mockReset();
  replace.mockReset();
  push.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  search = "";
  role = "viewer";
});

describe("ListeningQueriesView", () => {
  it("FR-051: loads the list with includeDeleted=false and limit=200 by default", async () => {
    const q = queryFixture();
    apiFetch.mockResolvedValue({ items: [q], nextCursor: null });
    setup();
    expect(await screen.findByText(q.displayName)).toBeInTheDocument();
    const [path, init] = apiFetch.mock.calls[0] as Call;
    expect(path).toBe(`/projects/${PID}/listening-queries`);
    expect(init.params).toMatchObject({ includeDeleted: "false", limit: "200" });
  });

  it("?deleted=1 requests includeDeleted=true; toggling writes the URL", async () => {
    search = "deleted=1";
    apiFetch.mockResolvedValue({ items: [queryFixture()], nextCursor: null });
    setup();
    await waitFor(() => expect((apiFetch.mock.calls[0] as Call)[1].params.includeDeleted).toBe("true"));
    fireEvent.click(screen.getByRole("switch", { name: "Hiện truy vấn đã xoá" }));
    expect(replace).toHaveBeenCalledWith("/listening-queries");
  });

  it("turning on 'Hiện truy vấn đã xoá' sets ?deleted=1", async () => {
    apiFetch.mockResolvedValue({ items: [queryFixture()], nextCursor: null });
    setup();
    fireEvent.click(await screen.findByRole("switch", { name: "Hiện truy vấn đã xoá" }));
    expect(replace).toHaveBeenCalledWith("/listening-queries?deleted=1");
  });

  it("shows a loading state before data", () => {
    apiFetch.mockReturnValue(new Promise(() => {}));
    setup();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("error state shows requestId and retries", async () => {
    apiFetch.mockRejectedValueOnce(new ApiError(500, "UNKNOWN", "Boom", "req-42"));
    setup();
    expect(await screen.findByTestId("request-id")).toHaveTextContent("req-42");
    apiFetch.mockResolvedValue({ items: [], nextCursor: null });
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
  });

  it("FR-018: empty state — viewer gets text only, no 'Thêm truy vấn'", async () => {
    apiFetch.mockResolvedValue({ items: [], nextCursor: null });
    setup();
    expect(await screen.findByText("Chưa có truy vấn đang hoạt động")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thêm truy vấn" })).not.toBeInTheDocument();
  });

  it("FR-018: admin sees 'Thêm truy vấn'", async () => {
    role = "admin";
    apiFetch.mockResolvedValue({ items: [queryFixture()], nextCursor: null });
    setup();
    expect(await screen.findByRole("button", { name: "Thêm truy vấn" })).toBeInTheDocument();
  });

  describe("admin actions (#43)", () => {
    const JOB = "33333333-3333-4333-8333-333333333333";
    type Init = { method?: string; body?: string } | undefined;
    const list = (q: ReturnType<typeof queryFixture>) => ({ items: [q], nextCursor: null });
    const route = (q: ReturnType<typeof queryFixture>, mutate: (path: string, init: Init) => unknown) =>
      apiFetch.mockImplementation((path: string, init: Init) =>
        init?.method ? mutate(path, init) : Promise.resolve(list(q)),
      );
    const openMenu = async (q: ReturnType<typeof queryFixture>) => {
      fireEvent.click(await screen.findByRole("button", { name: `Thao tác cho ${q.displayName}` }));
    };
    const mutationCalls = () => (apiFetch.mock.calls as [string, Init][]).filter(([, i]) => i?.method);

    beforeEach(() => {
      role = "admin";
    });

    it("'Thêm truy vấn' is enabled and opens the create drawer", async () => {
      apiFetch.mockResolvedValue(list(queryFixture()));
      setup();
      const btn = await screen.findByRole("button", { name: "Thêm truy vấn" });
      expect(btn).toBeEnabled();
      fireEvent.click(btn);
      expect(await screen.findByRole("heading", { name: "THÊM TRUY VẤN" })).toBeInTheDocument();
    });

    it("TC-LQ-013 / FR-058: 'Chạy ngay' POSTs /run and toasts a link to the job", async () => {
      const q = queryFixture();
      route(q, () => Promise.resolve({ jobId: JOB, status: "queued" }));
      setup();
      await openMenu(q);
      fireEvent.click(screen.getByRole("menuitem", { name: "Chạy ngay" }));
      await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
      expect(mutationCalls()[0]?.[0]).toBe(`/projects/${PID}/listening-queries/${q.id}/run`);
      const [msg, opts] = toastSuccess.mock.calls[0] as [string, { action: { label: string; onClick: () => void } }];
      expect(msg).toBe("Đã xếp lịch đồng bộ");
      expect(opts.action.label).toBe("Xem lượt đồng bộ");
      opts.action.onClick();
      expect(push).toHaveBeenCalledWith(`/system-status?tab=sync-jobs&job=${JOB}`);
    });

    it("FR-058: 409 SYNC_ALREADY_RUNNING shows an error toast with the running job", async () => {
      const q = queryFixture();
      route(q, () => Promise.reject(new ApiError(409, "SYNC_ALREADY_RUNNING", "running", "r", { jobId: JOB })));
      setup();
      await openMenu(q);
      fireEvent.click(screen.getByRole("menuitem", { name: "Chạy ngay" }));
      await waitFor(() => expect(toastError).toHaveBeenCalled());
      expect(toastError.mock.calls[0]?.[0]).toBe("Truy vấn đang đồng bộ.");
    });

    it("FR-055: the row toggle PATCHes { enabled }", async () => {
      const q = queryFixture({ enabled: true });
      route(q, () => Promise.resolve({ ...q, enabled: false }));
      setup();
      fireEvent.click(await screen.findByRole("switch", { name: `Bật ${q.displayName}` }));
      await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Đã tắt truy vấn"));
      const [path, init] = mutationCalls()[0] ?? [];
      expect(path).toBe(`/projects/${PID}/listening-queries/${q.id}`);
      expect(init?.method).toBe("PATCH");
      expect(JSON.parse(init?.body ?? "")).toEqual({ enabled: false });
    });

    it("FR-057: 'Xoá' opens a confirm dialog; confirming DELETEs", async () => {
      const q = queryFixture();
      route(q, () => Promise.resolve(undefined));
      setup();
      await openMenu(q);
      fireEvent.click(screen.getByRole("menuitem", { name: "Xoá" }));
      expect(await screen.findByRole("heading", { name: "Xoá truy vấn?" })).toBeInTheDocument();
      expect(mutationCalls()).toHaveLength(0);
      fireEvent.click(screen.getByRole("button", { name: "Xoá" }));
      await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
      expect(toastSuccess.mock.calls[0]?.[0]).toBe("Đã xoá truy vấn");
      expect(mutationCalls()[0]?.[1]?.method).toBe("DELETE");
    });

    it("FR-057: 'Khôi phục' POSTs /restore", async () => {
      search = "deleted=1";
      const q = queryFixture({ deletedAt: "2026-10-13T00:00:00.000Z" });
      route(q, () => Promise.resolve({ ...q, deletedAt: null }));
      setup();
      await openMenu(q);
      fireEvent.click(screen.getByRole("menuitem", { name: "Khôi phục" }));
      await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Đã khôi phục truy vấn"));
      expect(mutationCalls()[0]?.[0]).toBe(`/projects/${PID}/listening-queries/${q.id}/restore`);
    });

    it("?edit=<id> opens the edit drawer for a loaded query (FR-053 link)", async () => {
      const q = queryFixture();
      search = `edit=${q.id}`;
      apiFetch.mockResolvedValue(list(q));
      setup();
      expect(await screen.findByRole("heading", { name: "SỬA TRUY VẤN" })).toBeInTheDocument();
    });
  });

  it("TC-LQ-021 / BR-033: viewer gets no admin controls", async () => {
    const q = queryFixture();
    apiFetch.mockResolvedValue({ items: [q], nextCursor: null });
    setup();
    expect(await screen.findByText(q.displayName)).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: `Bật ${q.displayName}` })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: `Thao tác cho ${q.displayName}` }));
    expect(screen.getAllByRole("menuitem")).toHaveLength(1);
  });
});
