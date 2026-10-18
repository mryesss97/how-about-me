import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ClientModule from "@/lib/api/client";
import { ApiError } from "@/lib/api/client";
import { detailFixture, overrideFixture } from "./fixtures.test-utils";
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

function setup(reviewContext?: { onOverrideSaved?: (markReviewed: boolean) => void }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MentionDetail mentionId={m.id} variant="page" reviewContext={reviewContext} />
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
    expect(screen.queryByText("Bài gốc")).toBeNull();
    resolve(m);
    expect(await screen.findByRole("region", { name: "Bài gốc" })).toBeInTheDocument();
  });

  it("#277: the two columns are Operate boards titled Bài gốc / Phân tích", async () => {
    apiFetch.mockResolvedValue(m);
    setup();
    expect(await screen.findByRole("heading", { level: 2, name: "Bài gốc" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Phân tích" })).toBeInTheDocument();
  });

  it("404 → Mention not found", async () => {
    apiFetch.mockRejectedValue(new ApiError(404, "NOT_FOUND", "nope", "req-1"));
    setup();
    expect(await screen.findByText("Không tìm thấy bài nhắc")).toBeInTheDocument();
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
    await screen.findByRole("button", { name: "Sao chép ID bài" });
    expect(screen.queryByRole("button", { name: "Phân tích lại" })).toBeNull();
  });

  it("analyst sees Re-analyze only when the project allows it", async () => {
    role = "analyst";
    allow = false;
    apiFetch.mockResolvedValue(m);
    setup();
    await screen.findByRole("button", { name: "Sao chép ID bài" });
    expect(screen.queryByRole("button", { name: "Phân tích lại" })).toBeNull();
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
    fireEvent.click(await screen.findByRole("button", { name: "Phân tích lại" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(dialog.querySelector("button:last-of-type") as HTMLElement);
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(`/projects/${PID}/mentions/${m.id}/reanalyze`, { method: "POST" }),
    );
    expect(toast.success).toHaveBeenCalledWith("Đã xếp hàng phân tích lại");
    expect(await screen.findByText("Đang phân tích")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Phân tích lại" })).toBeDisabled();
  });

  it("is disabled while the analysis is pending", async () => {
    apiFetch.mockResolvedValue(detailFixture({ ...m, analysis: { status: "processing" } }));
    setup();
    expect(await screen.findByRole("button", { name: "Phân tích lại" })).toBeDisabled();
  });

  it("409 ANALYSIS_ALREADY_PENDING → info toast", async () => {
    apiFetch.mockImplementation((_p: string, init?: { method?: string }) =>
      init?.method === "POST"
        ? Promise.reject(new ApiError(409, "ANALYSIS_ALREADY_PENDING", "pending", "req-2"))
        : Promise.resolve(m),
    );
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Phân tích lại" }));
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
    fireEvent.click(await screen.findByRole("button", { name: "Sao chép ID bài" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("post-42"));
    expect(toast.success).toHaveBeenCalledWith("Đã sao chép ID bài");
    fireEvent.click(screen.getByRole("button", { name: "Sao chép liên kết" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("https://www.threads.net/@alice/post/42"));
    expect(screen.getByRole("link", { name: /Mở trên Threads/ })).toHaveAttribute("rel", "noopener noreferrer");
  });
});

describe("#338 toolbar, Thử lại rule, per-field Sửa", () => {
  const failed = detailFixture({ ...m, analysis: { status: "failed", errorCode: "ANALYSIS_PROVIDER_ERROR" } });

  it("BR-033: analyst sees Thử lại and Phân tích lại on a failed post only when allowed", async () => {
    role = "analyst";
    apiFetch.mockResolvedValue(failed);
    setup();
    expect(await screen.findByRole("button", { name: "Thử lại" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Phân tích lại" })).toBeInTheDocument();
  });

  it("BR-033: analyst without allowAnalystReanalyze sees neither", async () => {
    role = "analyst";
    allow = false;
    apiFetch.mockResolvedValue(failed);
    setup();
    await screen.findByText(/Bộ phân tích đang lỗi/);
    expect(screen.queryByRole("button", { name: "Thử lại" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Phân tích lại" })).toBeNull();
  });

  it("admin always gets Thử lại, even when analysts are not allowed", async () => {
    allow = false;
    apiFetch.mockResolvedValue(failed);
    setup();
    expect(await screen.findByRole("button", { name: "Thử lại" })).toBeInTheDocument();
  });

  it("FR-155 / FR-015: viewer has no toolbar and no Sửa but can still copy", async () => {
    role = "viewer";
    apiFetch.mockResolvedValue(failed);
    setup();
    expect(await screen.findByRole("button", { name: "Sao chép ID bài" })).toBeInTheDocument();
    expect(screen.queryByRole("toolbar")).toBeNull();
    expect(screen.queryByRole("button", { name: "Thử lại" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Sửa/ })).toBeNull();
  });

  it("TC-REV-001: Sửa Cảm xúc opens the dialog with sentiment preselected and POSTs it", async () => {
    role = "analyst";
    apiFetch.mockImplementation((_p: string, init?: { method?: string }) =>
      Promise.resolve(init?.method === "POST" ? overrideFixture() : m),
    );
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Sửa Cảm xúc" }));
    const dialog = await screen.findByRole("dialog");
    const [field, value] = dialog.querySelectorAll("select");
    expect(field).toHaveValue("sentiment");
    fireEvent.change(value, { target: { value: "neutral" } });
    fireEvent.change(dialog.querySelector("textarea") as HTMLElement, { target: { value: "Sarcasm" } });
    fireEvent.click(screen.getByRole("button", { name: /Lưu ghi đè/ }));
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(`/projects/${PID}/mentions/${m.id}/overrides`, {
        method: "POST",
        body: JSON.stringify({ field: "sentiment", value: "neutral", reason: "Sarcasm" }),
      }),
    );
  });

  it("FR-195: toolbar Ghi đè preselects relevance on an uncertain post", async () => {
    role = "analyst";
    apiFetch.mockResolvedValue(
      detailFixture({ ...m, analysis: { relevance: { label: "uncertain", confidence: 0.5 } } }),
    );
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Ghi đè" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelectorAll("select")[0]).toHaveValue("relevance");
  });
});

describe("Override (FR-191, FR-193, FR-015)", () => {
  const ov = overrideFixture();

  it("viewer sees neither Override nor Revoke", async () => {
    role = "viewer";
    apiFetch.mockResolvedValue(detailFixture({ ...m, overrides: [ov] }));
    setup();
    await screen.findByRole("button", { name: "Sao chép ID bài" });
    expect(screen.queryByRole("button", { name: "Ghi đè" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Thu hồi" })).toBeNull();
  });

  it("analyst: Override → POST overrides → toast (TC-REV-001)", async () => {
    role = "analyst";
    apiFetch.mockImplementation((_p: string, init?: { method?: string }) =>
      Promise.resolve(init?.method === "POST" ? ov : m),
    );
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Ghi đè" }));
    const dialog = await screen.findByRole("dialog");
    const [, value] = dialog.querySelectorAll("select");
    fireEvent.change(value, { target: { value: "neutral" } });
    fireEvent.change(dialog.querySelector("textarea") as HTMLElement, { target: { value: "Sarcasm" } });
    fireEvent.click(screen.getByRole("button", { name: /Lưu ghi đè/ }));
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(`/projects/${PID}/mentions/${m.id}/overrides`, {
        method: "POST",
        body: JSON.stringify({ field: "sentiment", value: "neutral", reason: "Sarcasm" }),
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("Đã lưu ghi đè");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("409 OVERRIDE_CONFLICT → info toast and refetch", async () => {
    role = "analyst";
    apiFetch.mockImplementation((_p: string, init?: { method?: string }) =>
      init?.method === "POST"
        ? Promise.reject(new ApiError(409, "OVERRIDE_CONFLICT", "conflict", "req-3"))
        : Promise.resolve(m),
    );
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Ghi đè" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(dialog.querySelectorAll("select")[1], { target: { value: "neutral" } });
    fireEvent.change(dialog.querySelector("textarea") as HTMLElement, { target: { value: "x" } });
    const before = getCalls();
    fireEvent.click(screen.getByRole("button", { name: /Lưu ghi đè/ }));
    await waitFor(() => expect(toast.info).toHaveBeenCalledWith("Có ghi đè khác vừa được lưu cùng lúc"));
    await waitFor(() => expect(getCalls()).toBeGreaterThan(before));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("admin: Revoke → confirm → DELETE (FR-193)", async () => {
    apiFetch.mockImplementation((_p: string, init?: { method?: string }) =>
      Promise.resolve(init?.method === "DELETE" ? undefined : detailFixture({ ...m, overrides: [ov] })),
    );
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Thu hồi" }));
    fireEvent.click(await screen.findByRole("button", { name: "Thu hồi ghi đè" }));
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(`/projects/${PID}/mentions/${m.id}/overrides/${ov.id}`, {
        method: "DELETE",
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("Đã thu hồi ghi đè");
  });
});

// #339: Mentions ↔ Reviews link.
describe("MentionDetail review link (#339)", () => {
  const queued = { ...m, review: { reasons: ["uncertain" as const], status: "unreviewed" as const, reviewedAt: null } };

  it("FR-195: pending review → note + link to the queue", async () => {
    apiFetch.mockResolvedValue(queued);
    setup();
    expect(await screen.findByText("Đang chờ xem lại · Chưa chắc")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mở trong Cần xem lại" })).toHaveAttribute("href", `/reviews?item=${m.id}`);
  });

  it("inside the Reviews slide-out the note is hidden; saving an override reports followUp", async () => {
    const onOverrideSaved = vi.fn();
    apiFetch.mockImplementation((path: string, init?: { method?: string }) =>
      Promise.resolve(init?.method === "POST" ? overrideFixture() : queued),
    );
    setup({ onOverrideSaved });
    await screen.findByRole("region", { name: "Bài gốc" });
    expect(screen.queryByText(/Đang chờ xem lại/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Ghi đè/ }));
    const dialog = await screen.findByRole("dialog");
    const selects = within(dialog).getAllByRole("combobox") as HTMLSelectElement[];
    fireEvent.change(selects[0] as HTMLSelectElement, { target: { value: "sentiment" } });
    fireEvent.change(selects[1] as HTMLSelectElement, { target: { value: "neutral" } });
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "ok" } });
    expect(within(dialog).getByRole("checkbox", { name: "Đánh dấu đã xem lại sau khi lưu" })).toBeChecked();
    fireEvent.click(within(dialog).getByRole("button", { name: /Lưu ghi đè/ }));
    await waitFor(() => expect(onOverrideSaved).toHaveBeenCalledWith(true));
  });
});
