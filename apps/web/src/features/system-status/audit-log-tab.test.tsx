import { AUDIT_ACTIONS } from "@how-about-me/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ClientModule from "@/lib/api/client";
import { AuditLogTab } from "./audit-log-tab";
import { auditLogFixture } from "./fixtures.test-utils";
import { auditActionLabel, auditActionText } from "./format";

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
const auditCalls = () => (apiFetch.mock.calls as Call[]).filter(([p]) => p.endsWith("/audit-logs"));

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuditLogTab pid={PID} tz="Asia/Ho_Chi_Minh" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  apiFetch.mockReset();
  replace.mockReset();
  search = "tab=audit-log";
});

describe("AuditLogTab (FR-201)", () => {
  it("sends action + day bounds as UTC, `to` exclusive (next day start)", async () => {
    search = "tab=audit-log&action=data.purged&from=2026-10-01&to=2026-10-02";
    apiFetch.mockResolvedValue({ items: [], nextCursor: null });
    setup();
    await waitFor(() => expect(auditCalls().length).toBe(1));
    expect(auditCalls()[0]?.[1].params).toMatchObject({
      action: "data.purged",
      from: "2026-09-30T17:00:00.000Z",
      to: "2026-10-02T17:00:00.000Z",
    });
  });

  it("drops an unknown action from the URL filter", async () => {
    search = "tab=audit-log&action=evil.thing";
    apiFetch.mockResolvedValue({ items: [], nextCursor: null });
    setup();
    await waitFor(() => expect(auditCalls().length).toBe(1));
    expect(auditCalls()[0]?.[1].params?.action).toBeUndefined();
  });

  it("changing the action filter writes the URL", async () => {
    apiFetch.mockResolvedValue({ items: [], nextCursor: null });
    setup();
    fireEvent.change(await screen.findByLabelText(/^Thao tác/), { target: { value: "query.deleted" } });
    expect(replace).toHaveBeenCalledWith("/system-status?tab=audit-log&action=query.deleted", { scroll: false });
  });

  it("renders rows: system actor, legacy action raw, expandable metadata", async () => {
    apiFetch.mockResolvedValue({
      items: [
        auditLogFixture(),
        auditLogFixture({ actor: null, action: "legacy.action", metadata: null, requestId: null }),
      ],
      nextCursor: null,
    });
    setup();
    expect(await screen.findByText("Hệ thống")).toBeInTheDocument();
    // Label appears in the filter <option> and in the row cell.
    expect(screen.getAllByText("Đổi vai trò thành viên")).toHaveLength(2);
    expect(screen.getByText("legacy.action")).toBeInTheDocument();
    const btns = screen.getAllByRole("button", { name: "Chi tiết" });
    expect(btns).toHaveLength(1); // no metadata + no requestId → no expand button
    const [btn] = btns as [HTMLElement];
    expect(btn).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/"previousRole": "viewer"/)).toBeInTheDocument();
    expect(screen.getByText("Mã yêu cầu: req-audit-1")).toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    apiFetch.mockResolvedValue({ items: [], nextCursor: null });
    setup();
    expect(await screen.findByText("Chưa có thao tác nào khớp bộ lọc")).toBeInTheDocument();
  });

  it("'Tải thêm' fetches the next page by cursor", async () => {
    apiFetch
      .mockResolvedValueOnce({ items: [auditLogFixture()], nextCursor: "c1" })
      .mockResolvedValueOnce({ items: [auditLogFixture({ action: "data.purged" })], nextCursor: null });
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Tải thêm" }));
    await waitFor(() => expect(screen.getAllByText("Xoá dữ liệu")).toHaveLength(2));
    expect(auditCalls()[1]?.[1].params?.cursor).toBe("c1");
  });
});

describe("auditActionLabel", () => {
  it("covers every AUDIT_ACTIONS value and falls back to raw", () => {
    for (const a of AUDIT_ACTIONS) expect(auditActionLabel[a]).toBeTruthy();
    expect(auditActionText("unknown.x")).toBe("unknown.x");
  });
});
