import { AUDIT_ACTIONS } from "@how-about-me/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ClientModule from "@/lib/api/client";
import { AuditLogTab } from "./audit-log-tab";
import { auditLogFixture, uuid } from "./fixtures.test-utils";
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

const MEMBER = uuid(1);
/** Routes by path: audit pages in order, members list, empty query names. */
function mockApi(...pages: { items: unknown[]; nextCursor: string | null }[]) {
  let i = 0;
  apiFetch.mockImplementation((path: string) => {
    if (path.endsWith("/members"))
      return Promise.resolve([
        {
          userId: MEMBER,
          email: "lan@example.com",
          displayName: "Lan Admin",
          role: "admin",
          createdAt: "2026-10-01T00:00:00.000Z",
        },
      ]);
    if (path.endsWith("/listening-queries")) return Promise.resolve({ items: [], nextCursor: null });
    const page = pages[Math.min(i, pages.length - 1)] ?? { items: [], nextCursor: null };
    i += 1;
    return Promise.resolve(page);
  });
}
const table = async () => within(await screen.findByRole("table"));

beforeEach(() => {
  apiFetch.mockReset();
  replace.mockReset();
  search = "tab=audit-log";
});

describe("AuditLogTab (FR-201)", () => {
  it("sends action + day bounds as UTC, `to` exclusive (next day start)", async () => {
    search = "tab=audit-log&action=data.purged&from=2026-10-01&to=2026-10-02";
    mockApi();
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
    mockApi();
    setup();
    await waitFor(() => expect(auditCalls().length).toBe(1));
    expect(auditCalls()[0]?.[1].params?.action).toBeUndefined();
  });

  it("changing the action filter writes the URL", async () => {
    mockApi();
    setup();
    fireEvent.change(await screen.findByLabelText(/^Thao tác/), { target: { value: "query.deleted" } });
    expect(replace).toHaveBeenCalledWith("/system-status?tab=audit-log&action=query.deleted", { scroll: false });
  });

  it("renders rows: system actor, legacy action raw, metadata as fields + JSON toggle (#343 ops-12)", async () => {
    mockApi({
      items: [
        auditLogFixture(),
        auditLogFixture({ actor: null, action: "legacy.action", metadata: null, requestId: null }),
      ],
      nextCursor: null,
    });
    setup();
    const t = await table();
    expect(t.getByText("Hệ thống")).toBeInTheDocument();
    expect(t.getByText("Đổi vai trò thành viên")).toBeInTheDocument();
    expect(t.getByText("legacy.action")).toBeInTheDocument();
    const btns = t.getAllByRole("button", { name: "Chi tiết" });
    expect(btns).toHaveLength(1); // no metadata + no requestId → no expand button
    const [btn] = btns as [HTMLElement];
    expect(btn).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
    const meta = within(t.getByTestId("audit-meta"));
    expect(meta.getByText("Vai trò cũ")).toBeInTheDocument();
    expect(meta.getByText("viewer")).toBeInTheDocument();
    expect(t.getByText("Mã yêu cầu: req-audit-1")).toBeInTheDocument();
    expect(t.queryByText(/"previousRole": "viewer"/)).not.toBeInTheDocument();
    fireEvent.click(t.getByRole("button", { name: "Xem JSON" }));
    expect(t.getByText(/"previousRole": "viewer"/)).toBeInTheDocument();
  });

  it("#343 FR-142: entities link to where they live; unknown types stay text", async () => {
    const post = auditLogFixture({ entityType: "social_post", entityId: uuid(70), action: "review.marked" });
    const job = auditLogFixture({ entityType: "sync_job", entityId: uuid(71), action: "sync_job.retry_requested" });
    const query = auditLogFixture({
      entityType: "listening_query",
      entityId: uuid(72),
      action: "query.updated",
      metadata: { after: { displayName: "1zone" } },
    });
    const odd = auditLogFixture({ entityType: "mystery", entityId: uuid(73), action: "legacy.x" });
    mockApi({ items: [post, job, query, odd], nextCursor: null });
    setup();
    const t = await table();
    expect(t.getByRole("link", { name: /^Bài nhắc · / })).toHaveAttribute(
      "href",
      `/mentions/${uuid(70)}?back=${encodeURIComponent("/system-status?tab=audit-log")}`,
    );
    expect(t.getByRole("link", { name: /^Lượt đồng bộ · / })).toHaveAttribute(
      "href",
      `/system-status?tab=sync-jobs&job=${uuid(71)}`,
    );
    expect(t.getByRole("link", { name: "Truy vấn · 1zone" })).toHaveAttribute(
      "href",
      `/listening-queries?edit=${uuid(72)}`,
    );
    expect(t.getByText(/^mystery · /).closest("a")).toBeNull();
  });

  it("#343 FR-201: choosing 'Người thực hiện' writes actor= and sends actorUserId", async () => {
    mockApi();
    const { unmount } = setup();
    const select = await screen.findByLabelText(/^Người thực hiện/);
    await waitFor(() => expect(within(select).getByRole("option", { name: "Lan Admin" })).toBeInTheDocument());
    fireEvent.change(select, { target: { value: MEMBER } });
    expect(replace).toHaveBeenCalledWith(`/system-status?tab=audit-log&actor=${MEMBER}`, { scroll: false });
    unmount();
    search = `tab=audit-log&actor=${MEMBER}`;
    setup();
    await waitFor(() => expect(auditCalls().at(-1)?.[1].params?.actorUserId).toBe(MEMBER));
  });

  it("#343: a non-UUID actor in the URL is ignored", async () => {
    search = "tab=audit-log&actor=nope";
    mockApi();
    setup();
    await waitFor(() => expect(auditCalls().length).toBe(1));
    expect(auditCalls()[0]?.[1].params?.actorUserId).toBeUndefined();
  });

  it("#343: mobile card links the entity and expands details", async () => {
    const l = auditLogFixture();
    mockApi({ items: [l], nextCursor: null });
    setup();
    const card = within(await screen.findByTestId(`audit-card-${l.id}`));
    expect(card.getByRole("link", { name: /^Thành viên · / })).toHaveAttribute("href", "/settings/members");
    const btn = card.getByRole("button", { name: "Chi tiết" });
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
    expect(card.getByText("Mã yêu cầu: req-audit-1")).toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    mockApi();
    setup();
    expect(await screen.findByText("Chưa có thao tác nào khớp bộ lọc")).toBeInTheDocument();
  });

  it("'Tải thêm' fetches the next page by cursor", async () => {
    mockApi(
      { items: [auditLogFixture()], nextCursor: "c1" },
      { items: [auditLogFixture({ action: "data.purged" })], nextCursor: null },
    );
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Tải thêm" }));
    await waitFor(() => expect(within(screen.getByRole("table")).getAllByText("Xoá dữ liệu")).toHaveLength(1));
    expect(auditCalls()[1]?.[1].params?.cursor).toBe("c1");
  });
});

describe("auditActionLabel", () => {
  it("covers every AUDIT_ACTIONS value and falls back to raw", () => {
    for (const a of AUDIT_ACTIONS) expect(auditActionLabel[a]).toBeTruthy();
    expect(auditActionText("unknown.x")).toBe("unknown.x");
  });
});
