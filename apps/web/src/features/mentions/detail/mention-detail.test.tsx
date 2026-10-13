import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ClientModule from "@/lib/api/client";
import { ApiError } from "@/lib/api/client";
import { detailFixture } from "./fixtures.test-utils";
import { MentionDetail } from "./mention-detail";

const PID = "11111111-1111-4111-8111-111111111111";
const apiFetch = vi.fn();
const toast = vi.hoisted(() => ({ success: vi.fn(), info: vi.fn(), error: vi.fn() }));
let role: "admin" | "analyst" | "viewer" = "admin";
let allow = true;

vi.mock("@/lib/api/client", async (orig) => ({
  ...(await orig<typeof ClientModule>()),
  apiFetch: (...a: unknown[]) => apiFetch(...a),
}));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/features/auth/use-current-project", () => ({
  useCurrentProject: () => ({ project: { id: PID, timezone: "UTC" } }),
}));
vi.mock("@/features/auth/use-role", () => ({
  useRole: () => ({
    role,
    settings: { allowAnalystReanalyze: allow, allowViewerExport: false },
    isLoading: false,
    error: null,
    hasProject: true,
    hasRole: (rs: readonly string[]) => rs.includes(role),
  }),
}));

const m = detailFixture({ platformPostId: "post-42", permalink: "https://www.threads.net/@alice/post/42" });

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MentionDetail mentionId={m.id} variant="page" />
    </QueryClientProvider>,
  );
}

const getCalls = () => apiFetch.mock.calls.filter(([p]) => (p as string).endsWith(m.id)).length;

beforeEach(() => {
  apiFetch.mockReset();
  Object.values(toast).forEach((f) => f.mockReset());
  role = "admin";
  allow = true;
});

describe("MentionDetail states (FR-154)", () => {
  it("shows a skeleton while loading, then the post", async () => {
    let resolve: (v: unknown) => void = () => undefined;
    apiFetch.mockReturnValue(new Promise((r) => (resolve = r)));
    setup();
    expect(screen.queryByText("Original post")).toBeNull();
    resolve(m);
    expect(await screen.findByRole("region", { name: "Original post" })).toBeInTheDocument();
  });

  it("404 → Mention not found", async () => {
    apiFetch.mockRejectedValue(new ApiError(404, "NOT_FOUND", "nope", "req-1"));
    setup();
    expect(await screen.findByText("Mention not found")).toBeInTheDocument();
  });

  it("other errors show code and requestId", async () => {
    apiFetch.mockRejectedValue(new ApiError(500, "INTERNAL", "boom", "req-9"));
    setup();
    expect(await screen.findByText(/req-9/)).toBeInTheDocument();
  });
});

describe("Operations (FR-155, TC-MEN-013, TC-MEN-019)", () => {
  it("viewer does not see Re-analyze (BR-033)", async () => {
    role = "viewer";
    apiFetch.mockResolvedValue(m);
    setup();
    await screen.findByText("Copy post ID");
    expect(screen.queryByRole("button", { name: "Re-analyze" })).toBeNull();
  });

  it("analyst sees Re-analyze only when the project allows it", async () => {
    role = "analyst";
    allow = false;
    apiFetch.mockResolvedValue(m);
    setup();
    await screen.findByText("Copy post ID");
    expect(screen.queryByRole("button", { name: "Re-analyze" })).toBeNull();
  });

  it("admin: confirm → POST reanalyze → toast + pending banner (BR-024)", async () => {
    apiFetch.mockImplementation((path: string, init?: { method?: string }) =>
      Promise.resolve(
        init?.method === "POST"
          ? { runId: "00000000-0000-4000-8000-000000000999", status: "pending" }
          : getCalls() > 1
            ? detailFixture({ ...m, analysis: { status: "pending" } })
            : m,
      ),
    );
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Re-analyze" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(dialog.querySelector("button:last-of-type") as HTMLElement);
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(`/projects/${PID}/mentions/${m.id}/reanalyze`, { method: "POST" }),
    );
    expect(toast.success).toHaveBeenCalledWith("Re-analysis queued");
    expect(await screen.findByText("Analysis in progress")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Re-analyze" })).toBeDisabled();
  });

  it("is disabled while the analysis is pending", async () => {
    apiFetch.mockResolvedValue(detailFixture({ ...m, analysis: { status: "processing" } }));
    setup();
    expect(await screen.findByRole("button", { name: "Re-analyze" })).toBeDisabled();
  });

  it("409 ANALYSIS_ALREADY_PENDING → info toast", async () => {
    apiFetch.mockImplementation((_p: string, init?: { method?: string }) =>
      init?.method === "POST"
        ? Promise.reject(new ApiError(409, "ANALYSIS_ALREADY_PENDING", "pending", "req-2"))
        : Promise.resolve(m),
    );
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Re-analyze" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(dialog.querySelector("button:last-of-type") as HTMLElement);
    await waitFor(() => expect(toast.info).toHaveBeenCalled());
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("copies post ID and permalink with a toast", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    apiFetch.mockResolvedValue(m);
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Copy post ID" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("post-42"));
    expect(toast.success).toHaveBeenCalledWith("Post ID copied");
    fireEvent.click(screen.getByRole("button", { name: "Copy permalink" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("https://www.threads.net/@alice/post/42"));
    expect(screen.getByRole("link", { name: /Open on Threads/ })).toHaveAttribute("rel", "noopener noreferrer");
  });
});
