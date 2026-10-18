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
let search = "";

vi.mock("@/lib/api/client", async (orig) => ({
  ...(await orig<typeof ClientModule>()),
  apiFetch: (...a: unknown[]) => apiFetch(...a),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
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
});
