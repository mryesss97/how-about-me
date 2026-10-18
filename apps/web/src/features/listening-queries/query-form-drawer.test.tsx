import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ClientModule from "@/lib/api/client";
import { ApiError } from "@/lib/api/client";
import { queryFixture } from "./fixtures.test-utils";
import { QueryFormDrawer } from "./query-form-drawer";

const PID = "11111111-1111-4111-8111-111111111111";
const EXISTING = "22222222-2222-4222-8222-222222222222";
const apiFetch = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("@/lib/api/client", async (orig) => ({
  ...(await orig<typeof ClientModule>()),
  apiFetch: (...a: unknown[]) => apiFetch(...a),
}));
vi.mock("sonner", () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}));

const onClose = vi.fn();
const onOpenExisting = vi.fn();
const onRunNow = vi.fn();

function setup(mode: "create" | "edit", query?: ReturnType<typeof queryFixture>) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <QueryFormDrawer
        pid={PID}
        mode={mode}
        query={query}
        isOpen
        onClose={onClose}
        onOpenExisting={onOpenExisting}
        onRunNow={onRunNow}
      />
    </QueryClientProvider>,
  );
}

const field = (name: string) => screen.getByRole("textbox", { name: new RegExp(`^${name.replace(/[()]/g, "\\$&")}`) });
const sentBody = (i = 0) => JSON.parse((apiFetch.mock.calls[i] as [string, { body: string }])[1].body) as unknown;

beforeEach(() => {
  apiFetch.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  onClose.mockReset();
  onOpenExisting.mockReset();
  onRunNow.mockReset();
});

describe("QueryFormDrawer", () => {
  it("TC-LQ-023 / FR-052: invalid interval shows an inline error and disables submit", () => {
    setup("create");
    const interval = field("Chu kỳ quét (giây)");
    fireEvent.change(interval, { target: { value: "59" } });
    fireEvent.blur(interval);
    expect(screen.getByText("Chu kỳ quét 60–86400 giây.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tạo truy vấn" })).toBeDisabled();
  });

  it("submitting an empty form reveals errors and does not call the API", () => {
    setup("create");
    fireEvent.click(screen.getByRole("button", { name: "Tạo truy vấn" }));
    expect(screen.getByText("Tên hiển thị 1–80 ký tự.")).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("preset fills the poll interval in seconds", () => {
    setup("create");
    fireEvent.click(
      within(screen.getByRole("group", { name: "Chu kỳ quét có sẵn" })).getAllByRole("button")[2] as HTMLElement,
    );
    expect(field("Chu kỳ quét (giây)")).toHaveValue("1800");
  });

  it("create POSTs the parsed body (BR-004 strips #)", async () => {
    apiFetch.mockResolvedValue(queryFixture());
    setup("create");
    fireEvent.change(field("Tên hiển thị"), { target: { value: "Eventista" } });
    fireEvent.change(field("Giá trị truy vấn"), { target: { value: "#eventista" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo truy vấn" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Đã tạo truy vấn", expect.anything()));
    expect(apiFetch.mock.calls[0]?.[0]).toBe(`/projects/${PID}/listening-queries`);
    expect(sentBody()).toMatchObject({ displayName: "Eventista", queryValue: "eventista", pollIntervalSeconds: 600 });
    expect(onClose).toHaveBeenCalled();
  });

  it("#340 flows-6: create toast says when it syncs and offers 'Chạy ngay' (FR-058)", async () => {
    const created = queryFixture({ enabled: true });
    apiFetch.mockResolvedValue(created);
    setup("create");
    fireEvent.change(field("Tên hiển thị"), { target: { value: "Eventista" } });
    fireEvent.change(field("Giá trị truy vấn"), { target: { value: "eventista" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo truy vấn" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    const opts = toastSuccess.mock.calls[0]?.[1] as {
      description: string;
      action: { label: string; onClick: () => void };
    };
    expect(opts.description).toBe("Sẽ đồng bộ trong khoảng 1 phút.");
    expect(opts.action.label).toBe("Chạy ngay");
    opts.action.onClick();
    expect(onRunNow).toHaveBeenCalledWith(created);
  });

  it("#340 ops-1: edit shows the creator read-only", () => {
    setup("edit", queryFixture());
    expect(screen.getByText("Người tạo: An Admin")).toBeInTheDocument();
  });

  it("FR-054 / BR-009: edit disables value + type and PATCHes only the diff", async () => {
    const q = queryFixture({ displayName: "Old" });
    apiFetch.mockResolvedValue(q);
    setup("edit", q);
    expect(field("Giá trị truy vấn")).toBeDisabled();
    for (const r of screen.getAllByRole("radio")) expect(r).toBeDisabled();
    expect(screen.getByRole("button", { name: "Lưu" })).toBeDisabled();
    fireEvent.change(field("Tên hiển thị"), { target: { value: "New" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Đã lưu thay đổi"));
    const [path, init] = apiFetch.mock.calls[0] as [string, { method: string }];
    expect(path).toBe(`/projects/${PID}/listening-queries/${q.id}`);
    expect(init.method).toBe("PATCH");
    expect(sentBody()).toEqual({ displayName: "New" });
  });

  it("TC-LQ-005 / FR-053: 409 QUERY_DUPLICATE → toast with 'Xem truy vấn' opening the existing query", async () => {
    apiFetch.mockRejectedValue(new ApiError(409, "QUERY_DUPLICATE", "dup", "req-1", { existingId: EXISTING }));
    setup("create");
    fireEvent.change(field("Tên hiển thị"), { target: { value: "X" } });
    fireEvent.change(field("Giá trị truy vấn"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo truy vấn" }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    const [msg, opts] = toastError.mock.calls[0] as [string, { action: { label: string; onClick: () => void } }];
    expect(msg).toBe("Truy vấn này đã tồn tại");
    expect(opts.action.label).toBe("Xem truy vấn");
    act(() => opts.action.onClick());
    expect(onOpenExisting).toHaveBeenCalledWith(EXISTING);
  });
});
